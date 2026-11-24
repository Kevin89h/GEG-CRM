import { NextRequest, NextResponse } from "next/server"
import { nextPartialDeliveryNoteNumber } from "@/lib/numbering"
import { deliveryRowsWithComments } from "@/lib/catalog"
import { createSchemaClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"
import { errorResponse, requireSchemaAccess } from "@/lib/access"
import { stockEngine } from "@/lib/stock-engine"

interface DeliveryLine {
  order_line_id: string
  description?: string
  qty_to_deliver: number
  /** warehouse chosen by the user for this line (else the warehouse chosen for the whole delivery) */
  warehouse_id?: string | null
}

// POST { lines, warehouse_id, notes } — direct (partial) delivery of a CONFIRMED quote (permission "livraisons.creer").
// Phase 1 (D1, D6, D8): the delivery note and its lines are created, then confirmed by the SAME engine as any delivery
// note (livraison_confirmer): capped by what remains to deliver on each quote line, stock checked at that moment and
// never negative, moves linked to the note's lines, quote quantities updated in the same transaction. If the engine
// refuses, the draft just created by this request is removed: nothing is left behind and nothing left the stock.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const schema = await getCompanySchema()
    const access = await requireSchemaAccess(schema)
    const body = await req.json()
    const { warehouse_id, notes } = body as { warehouse_id?: string; notes?: string }
    const db = createSchemaClient(schema)

    const { data: order } = await db.from("sales_orders").select("status").eq("id", id).maybeSingle()
    if (!order) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })
    if (order.status !== "confirmed") return NextResponse.json({ error: "Seul un devis confirmé peut être livré directement" }, { status: 409 })

    const { data: srcLines } = await db.from("sales_order_lines").select("id, product_id, description, line_type, print_on_delivery, position").eq("order_id", id).order("position")
    type Src = { id: string; product_id: string | null; description: string; line_type: string | null; print_on_delivery: boolean | null }
    const src = (srcLines ?? []) as Src[]
    const srcById = new Map(src.map(s => [s.id, s]))
    const lines = ((body.lines ?? []) as DeliveryLine[]).filter(l => srcById.get(l.order_line_id)?.line_type !== "comment")
    if (!lines.length) return NextResponse.json({ error: "Aucune ligne à livrer" }, { status: 400 })
    if (lines.some(l => !srcById.has(l.order_line_id))) return NextResponse.json({ error: "Ligne de devis inconnue" }, { status: 400 })
    if (lines.some(l => !(Number(l.qty_to_deliver) >= 0))) return NextResponse.json({ error: "Quantité invalide" }, { status: 400 })

    // product of each line read from the DATABASE (an old free line uses its VALIDATED historical correspondence)
    const freeIds = src.filter(s => !s.product_id).map(s => s.id)
    const { data: validLinks } = freeIds.length
      ? await db.from("historical_line_links").select("line_id, product_id").eq("line_table", "sales_order_lines").eq("status", "validated").in("line_id", freeIds)
      : { data: [] }
    const linked = new Map(((validLinks ?? []) as { line_id: string; product_id: string }[]).map(l => [l.line_id, l.product_id]))
    const productOf = (lineId: string) => srcById.get(lineId)?.product_id ?? linked.get(lineId) ?? null
    const unlinked = lines.filter(l => !productOf(l.order_line_id) && Number(l.qty_to_deliver) > 0)
    if (unlinked.length) {
      return NextResponse.json({
        error: `Ligne(s) non rattachée(s) au catalogue : ${unlinked.map(l => `« ${srcById.get(l.order_line_id)!.description} »`).join(", ")}. Rattachez chaque ligne à sa fiche (produit ou prestation) avant de livrer.`,
        unlinked: unlinked.map(l => ({ order_line_id: l.order_line_id, description: srcById.get(l.order_line_id)!.description })),
      }, { status: 409 })
    }

    const blNumber = await nextPartialDeliveryNoteNumber(db)
    const { data: dn, error: dnError } = await db.from("delivery_notes")
      .insert([{ number: blNumber, order_id: id, status: "draft", user_id: access.userId, notes: notes ?? null }]).select("id, number").single()
    if (dnError || !dn) return NextResponse.json({ error: dnError?.message ?? "Impossible de créer le bon de livraison" }, { status: 400 })

    const byLine = new Map(lines.map(l => [l.order_line_id, l]))
    const toRow = (l: DeliveryLine) => ({
      order_line_id: l.order_line_id, product_id: productOf(l.order_line_id), description: srcById.get(l.order_line_id)!.description,
      quantity: Number(l.qty_to_deliver), qty_delivered: Number(l.qty_to_deliver), warehouse_id: l.warehouse_id || warehouse_id || null,
    })
    const rows = deliveryRowsWithComments(src, s => { const l = byLine.get(s.id); return l ? toRow(l) : null })
    const { error: linesError } = await db.from("delivery_note_lines").insert(rows.map(r => ({ line_type: "product", print_on_delivery: true, ...r, delivery_note_id: dn.id })))
    const removeDraft = () => db.from("delivery_notes").delete().eq("id", dn.id).eq("status", "draft")
    if (linesError) { await removeDraft(); return NextResponse.json({ error: linesError.message }, { status: 400 }) }

    const r = await stockEngine(db, "livraison_confirmer", { p_dn: dn.id, p_lines: [], p_user: access.userId })
    if (!r.ok) { await removeDraft(); return r.response }

    // quote status from its lines (behaviour kept as before; ANO-002 is tracked separately)
    const { data: allLines } = await db.from("sales_order_lines").select("quantity, qty_delivered, line_type").eq("order_id", id)
    const goods = ((allLines ?? []) as { quantity: number; qty_delivered: number; line_type: string | null }[]).filter(l => l.line_type !== "comment")
    if (goods.length) {
      const all = goods.every(l => Number(l.qty_delivered ?? 0) >= Number(l.quantity ?? 0))
      const any = goods.some(l => Number(l.qty_delivered ?? 0) > 0)
      const newStatus = all ? "invoiced" : any ? "partial_delivery" : undefined
      if (newStatus) await db.from("sales_orders").update({ status: newStatus }).eq("id", id)
    }
    return NextResponse.json({ deliveryNoteId: dn.id, number: dn.number })
  } catch (err) {
    return errorResponse(err)
  }
}
