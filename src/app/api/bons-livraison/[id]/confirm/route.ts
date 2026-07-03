import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { lines, userId } = body as {
    lines: { id: string; product_id: string | null; quantity: number; warehouse_id: string | null }[]
    userId: string
  }

  const { db } = await createCompanyClient()

  // Save updated quantities/warehouses on delivery note lines
  for (const l of lines) {
    const { error } = await db
      .from("delivery_note_lines")
      .update({ quantity: l.quantity, warehouse_id: l.warehouse_id })
      .eq("id", l.id)
    if (error) return NextResponse.json({ error: `delivery_note_lines update: ${error.message}` }, { status: 400 })
  }

  // Create stock out moves and update stock_levels for product lines
  const stockLines = lines.filter(l => l.product_id && l.warehouse_id)
  if (stockLines.length > 0) {
    const { error: moveErr } = await db.from("stock_moves").insert(
      stockLines.map(l => ({
        type: "out",
        product_id: l.product_id,
        from_warehouse_id: l.warehouse_id,
        quantity: l.quantity,
        notes: `Livraison BL#${id}`,
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
        { product_id: l.product_id!, warehouse_id: l.warehouse_id!, quantity: Math.max(0, current - l.quantity) },
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

  return NextResponse.json({ ok: true })
}
