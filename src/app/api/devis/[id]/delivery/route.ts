import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"
import { requireSchemaAccess, AccessError } from "@/lib/access"
import { canOverrideStock, deliveryShortages, derogationReason } from "@/lib/delivery-rules"

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
  let role = ""
  try { role = (await requireSchemaAccess(schema)).role } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (createAdminClient() as any).schema(schema)

  // Targeted fix R4 + ANO-001 (18/11/2026): catalogue sheets read from the database (never from the browser); a line
  // without a sheet blocks the delivery (it is not a service); service sheets never move stock; stock checked BEFORE
  // any write, a shortage blocks unless an ADMIN gives a justified derogation (traced); real quantity kept, never 0.
  const { data: srcLines } = await db.from("sales_order_lines").select("id, product_id").eq("order_id", id)
  const srcById = new Map(((srcLines ?? []) as { id: string; product_id: string | null }[]).map(s => [s.id, s.product_id]))
  if (lines.some(l => !srcById.has(l.order_line_id))) return NextResponse.json({ error: "Ligne de devis inconnue" }, { status: 400 })
  lines = lines.map(l => ({ ...l, qty_to_deliver: Number(l.qty_to_deliver), product_id: srcById.get(l.order_line_id) ?? null }))
  if (lines.some(l => !(l.qty_to_deliver >= 0))) return NextResponse.json({ error: "Quantité invalide" }, { status: 400 })
  const unlinked = lines.filter(l => !l.product_id && l.qty_to_deliver > 0)
  if (unlinked.length) {
    return NextResponse.json({
      error: `Ligne(s) non rattachée(s) au catalogue : ${unlinked.map(l => `« ${l.description} »`).join(", ")}. Rattachez chaque ligne à sa fiche (produit ou prestation) avant de livrer.`,
    }, { status: 409 })
  }
  const { shortages, stockLines } = await deliveryShortages(db, lines.map(l => ({ product_id: l.product_id, warehouse_id, quantity: l.qty_to_deliver })))
  let derogation: string | null = null
  if (shortages.length) {
    const canOverride = canOverrideStock(role)
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
      notes: [notes, derogation ? `Dérogation stock insuffisant : ${derogation} — ${shortages.map(s => `${s.product} @ ${s.warehouse} : ${s.requested} demandé(s), ${s.available} disponible(s)`).join(" ; ")}` : null].filter(Boolean).join("\n") || null,
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
        notes: derogation ? `Livraison partielle ${blNumber} — DÉROGATION stock insuffisant : ${derogation}` : `Livraison partielle ${blNumber}`,
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
        { product_id: l.product_id!, warehouse_id, quantity: current - l.qty_to_deliver },
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

  return NextResponse.json({ deliveryNoteId: dn.id, number: blNumber })
}
