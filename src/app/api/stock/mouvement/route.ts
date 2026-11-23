import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireSchemaAccess } from "@/lib/access"
import { getCompanySchema } from "@/lib/company"
import { CONCURRENT_MSG, casLevel, readLevel } from "@/lib/stock-write"

// POST { type, product_id, from_warehouse_id, to_warehouse_id, quantity, notes } — manual stock operation
// (permission "stock.mouvement_manuel", checked by the middleware). Phase 0 of the stock reliability plan (A5, 23/11/2026):
// - active company (no longer hard-coded to Guinée), author = signed-in user (read on the server);
// - every check is done BEFORE any write: a refused operation writes nothing (no stock move);
// - stock levels never become negative; each level change is a compare-and-set (no lost update);
// - the stock move is written only after the level change succeeded; if it fails, the level is put back.
const TYPES = ["in", "out", "transfer", "adjustment", "damaged", "lost", "destroyed"] as const
const FROM = ["out", "transfer", "damaged", "lost", "destroyed"]
const TO = ["in", "transfer"]

export async function POST(req: NextRequest) {
  try {
    const schema = await getCompanySchema()
    const access = await requireSchemaAccess(schema)
    const body = await req.json()
    const type = String(body.type ?? "") as (typeof TYPES)[number]
    const productId = String(body.product_id ?? "")
    const fromId: string | null = body.from_warehouse_id || null
    const toId: string | null = body.to_warehouse_id || null
    const quantity = Number(body.quantity)
    const notes: string | null = body.notes ? String(body.notes) : null

    if (!TYPES.includes(type)) return NextResponse.json({ error: "Type de mouvement inconnu" }, { status: 400 })
    if (!productId) return NextResponse.json({ error: "Choisissez un produit" }, { status: 400 })
    if (!Number.isFinite(quantity) || (type === "adjustment" ? quantity < 0 : quantity <= 0)) {
      return NextResponse.json({ error: type === "adjustment" ? "La quantité cible ne peut pas être négative" : "La quantité doit être supérieure à 0" }, { status: 400 })
    }
    if (FROM.includes(type) && !fromId) return NextResponse.json({ error: "Choisissez le dépôt de départ" }, { status: 400 })
    if ((TO.includes(type) || type === "adjustment") && !toId) return NextResponse.json({ error: "Choisissez le dépôt" }, { status: 400 })
    if (type === "transfer" && fromId === toId) return NextResponse.json({ error: "Les deux dépôts doivent être différents" }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (createAdminClient() as any).schema(schema)
    const { data: product } = await db.from("products").select("id, name, product_code, product_type").eq("id", productId).maybeSingle()
    if (!product) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    if (product.product_type === "service") return NextResponse.json({ error: `« ${product.name} » est une prestation : aucun mouvement de stock possible` }, { status: 400 })
    const whIds = [fromId, toId].filter(Boolean) as string[]
    const { data: whs } = await db.from("warehouses").select("id, name, is_active").in("id", whIds)
    const whName = new Map(((whs ?? []) as { id: string; name: string; is_active: boolean }[]).filter(w => w.is_active).map(w => [w.id, w.name]))
    if (whIds.some(w => !whName.has(w))) return NextResponse.json({ error: "Dépôt introuvable ou inactif" }, { status: 400 })
    const label = `${product.product_code ? product.product_code + " " : ""}${product.name}`

    // 1. read and check everything first
    const fromLevel = FROM.includes(type) ? await readLevel(db, productId, fromId!) : null
    if (fromLevel && fromLevel.quantity < quantity) {
      return NextResponse.json({
        error: `Stock insuffisant : ${label} — dépôt ${whName.get(fromId!)} : ${fromLevel.quantity} disponible(s), ${quantity} demandé(s). Rien n'a été enregistré.`,
        shortage: { product: label, warehouse: whName.get(fromId!), requested: quantity, available: fromLevel.quantity },
      }, { status: 422 })
    }
    const toLevel = TO.includes(type) || type === "adjustment" ? await readLevel(db, productId, toId!) : null
    if (type === "adjustment" && toLevel!.quantity === quantity) return NextResponse.json({ ok: true, delta: 0 })

    // 2. level changes (compare-and-set), the source first
    const undo: (() => Promise<unknown>)[] = []
    if (fromLevel) {
      if (!(await casLevel(db, productId, fromId!, fromLevel, fromLevel.quantity - quantity))) return NextResponse.json({ error: CONCURRENT_MSG }, { status: 409 })
      undo.push(() => casLevel(db, productId, fromId!, { exists: true, quantity: fromLevel.quantity - quantity }, fromLevel.quantity))
    }
    if (toLevel) {
      const next = type === "adjustment" ? quantity : toLevel.quantity + quantity
      if (!(await casLevel(db, productId, toId!, toLevel, next))) {
        for (const u of undo) await u()
        return NextResponse.json({ error: CONCURRENT_MSG }, { status: 409 })
      }
      undo.push(() => toLevel.exists ? casLevel(db, productId, toId!, { exists: true, quantity: next }, toLevel.quantity) : db.from("stock_levels").delete().eq("product_id", productId).eq("warehouse_id", toId!).eq("quantity", next))
    }

    // 3. the stock move (traceability); if it cannot be written, the levels are put back
    const delta = type === "adjustment" ? quantity - toLevel!.quantity : null
    const { error: moveErr } = await db.from("stock_moves").insert([{
      type,
      product_id: productId,
      quantity: type === "adjustment" ? Math.abs(delta!) : quantity,
      from_warehouse_id: FROM.includes(type) ? fromId : null,
      to_warehouse_id: TO.includes(type) || type === "adjustment" ? toId : null,
      notes: type === "adjustment" ? (notes ? `Ajustement : ${toLevel!.quantity} → ${quantity} — ${notes}` : `Ajustement : ${toLevel!.quantity} → ${quantity}`) : notes,
      user_id: access.userId,
    }])
    if (moveErr) {
      for (const u of undo.reverse()) await u()
      return NextResponse.json({ error: `Mouvement non enregistré (${moveErr.message}) : le stock est inchangé` }, { status: 400 })
    }
    return NextResponse.json({ ok: true, ...(delta !== null ? { delta } : {}) })
  } catch (err) {
    return errorResponse(err)
  }
}
