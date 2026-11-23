import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"
import { hasPermission } from "@/lib/access"
import { deliveryShortages, derogationReason } from "@/lib/catalog"

// POST { lines, userId, derogation?: { reason, confirmed } } — confirms a delivery note (stock out).
// R4: blocked when a line exceeds the stock of its warehouse, unless the user holds
// "stock.livraison_hors_stock" and gives an explicit confirmation and a justification (audited).
// The real resulting quantity is recorded, negative if needed (never silently set to 0).
// R5: service products never create stock moves.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  let { lines } = body as {
    lines: { id: string; product_id: string | null; quantity: number; warehouse_id: string | null }[]
  }
  const { userId } = body as {
    lines: { id: string; product_id: string | null; quantity: number; warehouse_id: string | null }[]
    userId: string
  }
  if (!Array.isArray(lines)) return NextResponse.json({ error: "Lignes du bon de livraison manquantes" }, { status: 400 })

  const schema = await getCompanySchema()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (createAdminClient() as any).schema(schema)

  const { data: dn } = await db.from("delivery_notes").select("status, number").eq("id", id).single()
  if (!dn) return NextResponse.json({ error: "Bon de livraison introuvable" }, { status: 404 })
  if (dn.status !== "draft") return NextResponse.json({ error: "Ce bon de livraison n'est plus en brouillon" }, { status: 409 })

  // Catalogue sheet of each line read from the DATABASE (never trusted from the browser). A line without a sheet is
  // not a service: it must be linked first (regression 17/11/2026: a physical product left the stock untouched).
  const { data: dbLines } = await db.from("delivery_note_lines").select("id, product_id, description, line_type").eq("delivery_note_id", id)
  const dbById = new Map(((dbLines ?? []) as { id: string; product_id: string | null; description: string; line_type: string | null }[]).map(l => [l.id, l]))
  lines = lines.filter(l => dbById.has(l.id) && dbById.get(l.id)!.line_type !== "comment").map(l => ({ ...l, product_id: dbById.get(l.id)!.product_id }))
  const unlinked = lines.filter(l => !l.product_id && Number(l.quantity) > 0)
  if (unlinked.length) {
    return NextResponse.json({
      error: `Ligne(s) non rattachée(s) au catalogue : ${unlinked.map(l => `« ${dbById.get(l.id)!.description} »`).join(", ")}. Rattachez chaque ligne à sa fiche (produit ou prestation) avant de valider.`,
      unlinked: unlinked.map(l => ({ id: l.id, description: dbById.get(l.id)!.description })),
    }, { status: 409 })
  }

  // Stock check before any write
  const { shortages, stockLines } = await deliveryShortages(db, lines.map(l => ({ product_id: l.product_id, warehouse_id: l.warehouse_id, quantity: Number(l.quantity) })))
  let derogation: string | null = null
  if (shortages.length) {
    const canOverride = await hasPermission("stock.livraison_hors_stock")
    const reason = derogationReason(body)
    if (!reason || !canOverride) {
      return NextResponse.json({
        error: canOverride
          ? "Stock insuffisant : confirmez la dérogation et indiquez une justification (10 caractères minimum)"
          : "Stock insuffisant : livraison impossible au-delà du stock disponible",
        shortages, canOverride,
      }, { status: canOverride ? 409 : 403 })
    }
    derogation = reason
  }

  // A physical product line must have a warehouse: otherwise it would silently leave the stock untouched (phase 0, D6)
  const productIds = [...new Set(lines.filter(l => l.product_id && Number(l.quantity) > 0).map(l => l.product_id as string))]
  if (productIds.length) {
    const { data: types } = await db.from("products").select("id, product_type").in("id", productIds)
    const service = new Set(((types ?? []) as { id: string; product_type: string | null }[]).filter(p => p.product_type === "service").map(p => p.id))
    const noWarehouse = lines.filter(l => l.product_id && Number(l.quantity) > 0 && !service.has(l.product_id) && !l.warehouse_id)
    if (noWarehouse.length) {
      return NextResponse.json({
        error: `Choisissez le dépôt de sortie pour : ${noWarehouse.map(l => `« ${dbById.get(l.id)!.description} »`).join(", ")}`,
      }, { status: 400 })
    }
  }

  // Phase 0 (D2): the delivery note is CLAIMED first, with a conditional update (draft → delivered). Two simultaneous
  // confirmations cannot both pass: the second one finds no draft and stops before any stock write. If a later write
  // fails, the claim is released (back to draft) and the error is returned. Phase 1 replaces this with one transaction.
  const today = new Date().toISOString().split("T")[0]
  const { data: claimed, error: claimErr } = await db.from("delivery_notes")
    .update({ status: "delivered", delivery_date: today }).eq("id", id).eq("status", "draft").select("id")
  if (claimErr) return NextResponse.json({ error: `delivery_notes: ${claimErr.message}` }, { status: 400 })
  if (!claimed?.length) return NextResponse.json({ error: "Ce bon de livraison vient d'être confirmé par une autre opération : rien n'a été fait" }, { status: 409 })
  const release = async (msg: string) => {
    await db.from("delivery_notes").update({ status: "draft", delivery_date: null }).eq("id", id).eq("status", "delivered")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Save updated quantities/warehouses on delivery note lines (comment lines are text only: left as they are)
  const { data: commentRows } = await db.from("delivery_note_lines").select("id").eq("delivery_note_id", id).eq("line_type", "comment")
  const commentIds = new Set((commentRows ?? []).map((r: { id: string }) => r.id))
  for (const l of lines) {
    if (commentIds.has(l.id)) continue
    const { error } = await db
      .from("delivery_note_lines")
      .update({ quantity: l.quantity, warehouse_id: l.warehouse_id })
      .eq("id", l.id)
    if (error) return release(`delivery_note_lines update: ${error.message}`)
  }

  // Stock out moves and stock levels (goods only); the real quantity is kept, even negative
  if (stockLines.length > 0) {
    const { error: moveErr } = await db.from("stock_moves").insert(
      stockLines.map(l => ({
        type: "out",
        product_id: l.product_id,
        from_warehouse_id: l.warehouse_id,
        quantity: l.quantity,
        notes: derogation ? `Livraison BL ${dn.number} — dérogation stock : ${derogation}` : `Livraison BL ${dn.number}`,
        user_id: userId,
      }))
    )
    if (moveErr) return release(`stock_moves: ${moveErr.message}`)

    for (const l of stockLines) {
      const { data: level } = await db
        .from("stock_levels")
        .select("quantity")
        .eq("product_id", l.product_id!)
        .eq("warehouse_id", l.warehouse_id!)
        .maybeSingle()
      const current = Number(level?.quantity ?? 0)
      const { error: levelErr } = await db.from("stock_levels").upsert(
        { product_id: l.product_id!, warehouse_id: l.warehouse_id!, quantity: current - Number(l.quantity) },
        { onConflict: "product_id,warehouse_id" }
      )
      if (levelErr) return NextResponse.json({ error: `stock_levels: ${levelErr.message}` }, { status: 400 })
    }
  }

  if (derogation) {
    await createAdminClient().rpc("audit_log_event", {
      p_company: schema, p_module: "stock", p_action: "livraison.derogation_stock", p_entity_type: "delivery_notes",
      p_entity_id: id, p_label: dn.number, p_details: { justification: derogation, ecarts: shortages },
    })
  }

  return NextResponse.json({ ok: true, derogation: !!derogation, shortages })
}
