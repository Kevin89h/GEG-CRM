import { NextRequest, NextResponse } from "next/server"
import { hasPermission } from "@/lib/access"
import { deliveryShortages, derogationReason } from "@/lib/catalog"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"

interface DeliveryLine {
  order_line_id: string
  product_id: string | null
  description: string
  qty_to_deliver: number
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  let { lines } = body as { lines: DeliveryLine[] }
  const { warehouse_id, notes, user_id } = body as {
    lines: DeliveryLine[]
    warehouse_id: string
    notes?: string
    user_id: string
  }

  if (!lines || lines.length === 0) {
    return NextResponse.json({ error: "Aucune ligne à livrer" }, { status: 400 })
  }

  const schema = await getCompanySchema()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (createAdminClient() as any).schema(schema)

  // Comment lines (text only) are never delivered
  const { data: commentRows } = await db.from("sales_order_lines").select("id").eq("order_id", id).eq("line_type", "comment")
  const commentIds = new Set((commentRows ?? []).map((r: { id: string }) => r.id))
  lines = lines.filter(l => !commentIds.has(l.order_line_id))
  if (lines.length === 0) return NextResponse.json({ error: "Aucune ligne à livrer" }, { status: 400 })

  // R4: stock check BEFORE creating the delivery note; derogation only with "stock.livraison_hors_stock",
  // explicit confirmation and justification (audited). R5: services never move stock.
  const { shortages, stockLines } = await deliveryShortages(db, lines.map(l => ({ product_id: l.product_id, warehouse_id, quantity: Number(l.qty_to_deliver) })))
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
  const stockProductIds = new Set(stockLines.map(l => l.product_id))

  // Generate BL number
  const { count } = await db.from("delivery_notes").select("id", { count: "exact", head: true })
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const seq = String((count ?? 0) + 1).padStart(5, "0")
  const blNumber = `BL-${year}-${month}-${seq}`

  // Create delivery note
  const { data: dn, error: dnError } = await db
    .from("delivery_notes")
    .insert([{
      number: blNumber,
      order_id: id,
      status: "draft",
      user_id,
      notes: notes ?? null,
    }])
    .select("id")
    .single()

  if (dnError || !dn) {
    return NextResponse.json({ error: dnError?.message ?? "Impossible de créer le bon de livraison" }, { status: 400 })
  }

  // Create delivery note lines
  const { error: linesError } = await db.from("delivery_note_lines").insert(
    lines.map((l, i) => ({
      delivery_note_id: dn.id,
      order_line_id: l.order_line_id,
      product_id: l.product_id ?? null,
      description: l.description,
      quantity: l.qty_to_deliver,
      qty_delivered: l.qty_to_deliver,
      position: i,
    }))
  )
  if (linesError) {
    return NextResponse.json({ error: linesError.message }, { status: 400 })
  }

  // Stock moves and stock_levels update for product lines
  const productLines = lines.filter(l => l.product_id && l.qty_to_deliver > 0 && stockProductIds.has(l.product_id))
  if (productLines.length > 0) {
    const { error: moveErr } = await db.from("stock_moves").insert(
      productLines.map(l => ({
        type: "out",
        product_id: l.product_id,
        from_warehouse_id: warehouse_id,
        quantity: l.qty_to_deliver,
        notes: `Livraison partielle ${blNumber}`,
        user_id,
      }))
    )
    if (moveErr) {
      return NextResponse.json({ error: `stock_moves: ${moveErr.message}` }, { status: 400 })
    }

    for (const l of productLines) {
      const { data: level } = await db
        .from("stock_levels")
        .select("quantity")
        .eq("product_id", l.product_id!)
        .eq("warehouse_id", warehouse_id)
        .maybeSingle()
      const current = Number(level?.quantity ?? 0)
      const { error: levelErr } = await db.from("stock_levels").upsert(
        { product_id: l.product_id!, warehouse_id, quantity: current - Number(l.qty_to_deliver) },
        { onConflict: "product_id,warehouse_id" }
      )
      if (levelErr) {
        return NextResponse.json({ error: `stock_levels: ${levelErr.message}` }, { status: 400 })
      }
    }
  }

  // Update qty_delivered on each order line
  for (const l of lines) {
    const { error: qtyErr } = await db.rpc("increment_order_line_qty_delivered", {
      p_line_id: l.order_line_id,
      p_qty: l.qty_to_deliver,
    })
    if (qtyErr) {
      // Fallback: manual read-then-update
      const { data: ol } = await db
        .from("sales_order_lines")
        .select("qty_delivered, quantity")
        .eq("id", l.order_line_id)
        .single()
      if (ol) {
        await db
          .from("sales_order_lines")
          .update({ qty_delivered: Number(ol.qty_delivered ?? 0) + l.qty_to_deliver })
          .eq("id", l.order_line_id)
      }
    }
  }

  // Recalculate order status based on all lines
  const { data: allLines } = await db
    .from("sales_order_lines")
    .select("quantity, qty_delivered")
    .eq("order_id", id)

  if (allLines && allLines.length > 0) {
    const allDelivered = allLines.every(
      (ol: { quantity: number; qty_delivered: number }) =>
        Number(ol.qty_delivered ?? 0) >= Number(ol.quantity ?? 0)
    )
    const anyDelivered = allLines.some(
      (ol: { quantity: number; qty_delivered: number }) =>
        Number(ol.qty_delivered ?? 0) > 0
    )

    const newStatus = allDelivered ? "invoiced" : anyDelivered ? "partial_delivery" : undefined
    if (newStatus) {
      await db.from("sales_orders").update({ status: newStatus }).eq("id", id)
    }
  }

  if (derogation) {
    await createAdminClient().rpc("audit_log_event", {
      p_company: schema, p_module: "stock", p_action: "livraison.derogation_stock", p_entity_type: "delivery_notes",
      p_entity_id: dn.id, p_label: blNumber, p_details: { justification: derogation, ecarts: shortages },
    })
  }

  return NextResponse.json({ deliveryNoteId: dn.id, number: blNumber, derogation: !!derogation })
}
