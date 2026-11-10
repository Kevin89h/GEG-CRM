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
  const { lines, userId } = body as {
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

  // Save updated quantities/warehouses on delivery note lines
  for (const l of lines) {
    const { error } = await db
      .from("delivery_note_lines")
      .update({ quantity: l.quantity, warehouse_id: l.warehouse_id })
      .eq("id", l.id)
    if (error) return NextResponse.json({ error: `delivery_note_lines update: ${error.message}` }, { status: 400 })
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
    if (moveErr) return NextResponse.json({ error: `stock_moves: ${moveErr.message}` }, { status: 400 })

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

  // Mark delivery note as delivered
  const { error: dnErr } = await db
    .from("delivery_notes")
    .update({ status: "delivered", delivery_date: new Date().toISOString().split("T")[0] })
    .eq("id", id)
  if (dnErr) return NextResponse.json({ error: `delivery_notes: ${dnErr.message}` }, { status: 400 })

  if (derogation) {
    await createAdminClient().rpc("audit_log_event", {
      p_company: schema, p_module: "stock", p_action: "livraison.derogation_stock", p_entity_type: "delivery_notes",
      p_entity_id: id, p_label: dn.number, p_details: { justification: derogation, ecarts: shortages },
    })
  }

  return NextResponse.json({ ok: true, derogation: !!derogation, shortages })
}
