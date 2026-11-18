import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"
import { errorResponse, requireSchemaAccess } from "@/lib/access"
import { canOverrideStock, deliveryShortages, derogationReason } from "@/lib/delivery-rules"

// POST { lines, userId, derogation?: { reason, confirmed } } — confirms a DRAFT delivery note (stock out).
// Targeted fix R4 + ANO-001 (18/11/2026):
// - the catalogue sheet of each line is read from the database (never trusted from the browser);
// - a line without a catalogue sheet blocks the confirmation (it is not a service);
// - lines linked to a SERVICE sheet never move stock;
// - stock is checked per warehouse BEFORE any write; a shortage blocks, unless an ADMIN confirms a derogation with a
//   justification, traced on the stock move and on the delivery note;
// - the real resulting quantity is recorded (negative if needed), never silently set to 0.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { userId } = body as { userId: string }
    let { lines } = body as { lines: { id: string; product_id: string | null; quantity: number; warehouse_id: string | null }[] }
    if (!Array.isArray(lines)) return NextResponse.json({ error: "Lignes du bon de livraison manquantes" }, { status: 400 })

    const schema = await getCompanySchema()
    const access = await requireSchemaAccess(schema)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (createAdminClient() as any).schema(schema)

    const { data: dn } = await db.from("delivery_notes").select("status, number, notes").eq("id", id).single()
    if (!dn) return NextResponse.json({ error: "Bon de livraison introuvable" }, { status: 404 })
    if (dn.status !== "draft") return NextResponse.json({ error: "Ce bon de livraison n'est plus en brouillon" }, { status: 409 })

    // catalogue sheets from the database; lines of another delivery note are ignored
    const { data: dbLines } = await db.from("delivery_note_lines").select("id, product_id, description").eq("delivery_note_id", id)
    const byId = new Map(((dbLines ?? []) as { id: string; product_id: string | null; description: string }[]).map(l => [l.id, l]))
    lines = lines.filter(l => byId.has(l.id)).map(l => ({ ...l, quantity: Number(l.quantity), product_id: byId.get(l.id)!.product_id }))
    if (lines.some(l => !(l.quantity >= 0))) return NextResponse.json({ error: "Quantité invalide" }, { status: 400 })

    const unlinked = lines.filter(l => !l.product_id && l.quantity > 0)
    if (unlinked.length) {
      return NextResponse.json({
        error: `Ligne(s) non rattachée(s) au catalogue : ${unlinked.map(l => `« ${byId.get(l.id)!.description} »`).join(", ")}. Rattachez chaque ligne à sa fiche (produit ou prestation) avant de valider.`,
        unlinked: unlinked.map(l => ({ id: l.id, description: byId.get(l.id)!.description })),
      }, { status: 409 })
    }

    const { shortages, stockLines } = await deliveryShortages(db, lines)
    const physicalNoWarehouse = lines.filter(l => l.product_id && !l.warehouse_id && l.quantity > 0)
    if (physicalNoWarehouse.length) {
      const { data: pts } = await db.from("products").select("id, product_type").in("id", physicalNoWarehouse.map(l => l.product_id))
      if ((pts ?? []).some((p: { product_type: string | null }) => p.product_type !== "service")) {
        return NextResponse.json({ error: "Choisissez un entrepôt pour chaque produit" }, { status: 400 })
      }
    }
    let derogation: string | null = null
    if (shortages.length) {
      const canOverride = canOverrideStock(access.role)
      const reason = derogationReason(body)
      if (!reason || !canOverride) {
        return NextResponse.json({
          error: canOverride
            ? "Stock insuffisant : confirmez la dérogation et indiquez une justification (10 caractères minimum)"
            : "Stock insuffisant : livraison impossible au-delà du stock disponible (dérogation réservée à un administrateur)",
          shortages, canOverride,
        }, { status: canOverride ? 409 : 403 })
      }
      derogation = reason
    }

    // quantities and warehouses chosen on the screen
    for (const l of lines) {
      const { error } = await db.from("delivery_note_lines").update({ quantity: l.quantity, warehouse_id: l.warehouse_id }).eq("id", l.id).eq("delivery_note_id", id)
      if (error) return NextResponse.json({ error: `delivery_note_lines update: ${error.message}` }, { status: 400 })
    }

    const toMove = stockLines.filter(l => Number(l.quantity) > 0)
    if (toMove.length > 0) {
      const note = derogation
        ? `Livraison BL#${id} — DÉROGATION stock insuffisant (${dn.number}) : ${derogation}`
        : `Livraison BL#${id}`
      const { error: moveErr } = await db.from("stock_moves").insert(
        toMove.map(l => ({ type: "out", product_id: l.product_id, from_warehouse_id: l.warehouse_id, quantity: l.quantity, notes: note, user_id: userId || access.userId }))
      )
      if (moveErr) return NextResponse.json({ error: `stock_moves: ${moveErr.message}` }, { status: 400 })
      for (const l of toMove) {
        const { data: level } = await db.from("stock_levels").select("quantity").eq("product_id", l.product_id!).eq("warehouse_id", l.warehouse_id!).maybeSingle()
        const current = Number(level?.quantity ?? 0)
        // the real quantity is kept, even negative (only possible through a traced derogation)
        const { error: levelErr } = await db.from("stock_levels").upsert(
          { product_id: l.product_id!, warehouse_id: l.warehouse_id!, quantity: current - Number(l.quantity) },
          { onConflict: "product_id,warehouse_id" }
        )
        if (levelErr) return NextResponse.json({ error: `stock_levels: ${levelErr.message}` }, { status: 400 })
      }
    }

    const notes = derogation
      ? [dn.notes, `Dérogation stock insuffisant le ${new Date().toISOString().slice(0, 10)} (administrateur ${access.userId}) : ${derogation} — ${shortages.map(s => `${s.product} @ ${s.warehouse} : ${s.requested} demandé(s), ${s.available} disponible(s)`).join(" ; ")}`].filter(Boolean).join("\n")
      : dn.notes
    const { error: dnErr } = await db.from("delivery_notes")
      .update({ status: "delivered", delivery_date: new Date().toISOString().split("T")[0], notes })
      .eq("id", id).eq("status", "draft")
    if (dnErr) return NextResponse.json({ error: `delivery_notes: ${dnErr.message}` }, { status: 400 })

    return NextResponse.json({ ok: true, derogation: !!derogation })
  } catch (err) {
    return errorResponse(err)
  }
}
