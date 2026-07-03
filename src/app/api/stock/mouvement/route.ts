import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, product_id, from_warehouse_id, to_warehouse_id, quantity, notes, user_id } = body as {
    type: string
    product_id: string
    from_warehouse_id: string | null
    to_warehouse_id: string | null
    quantity: number
    notes: string | null
    user_id: string
  }

  const { db } = await createCompanyClient()

  if (type === "adjustment") {
    // For adjustment: quantity = target absolute value
    const { data: level } = await db
      .from("stock_levels")
      .select("quantity")
      .eq("product_id", product_id)
      .eq("warehouse_id", to_warehouse_id!)
      .maybeSingle()

    const currentQty = Number(level?.quantity ?? 0)
    const delta = quantity - currentQty

    if (delta !== 0) {
      const { error: moveErr } = await db.from("stock_moves").insert([{
        type: "adjustment",
        product_id,
        quantity: Math.abs(delta),
        notes: notes ?? `Ajustement: ${currentQty} → ${quantity}`,
        to_warehouse_id,
        from_warehouse_id: null,
        user_id,
      }])
      if (moveErr) return NextResponse.json({ error: moveErr.message }, { status: 400 })

      const { error: levelErr } = await db.from("stock_levels").upsert(
        { product_id, warehouse_id: to_warehouse_id!, quantity },
        { onConflict: "product_id,warehouse_id" }
      )
      if (levelErr) return NextResponse.json({ error: levelErr.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, delta })
  }

  // General move types: in, out, transfer, damaged, lost, destroyed
  const { error: moveErr } = await db.from("stock_moves").insert([{
    type, product_id, quantity, notes,
    from_warehouse_id: from_warehouse_id || null,
    to_warehouse_id: to_warehouse_id || null,
    user_id,
  }])
  if (moveErr) return NextResponse.json({ error: moveErr.message }, { status: 400 })

  // Update stock_levels
  const needsFrom = ["out", "transfer", "damaged", "lost", "destroyed"].includes(type)
  const needsTo = ["in", "transfer"].includes(type)

  if (needsFrom && from_warehouse_id) {
    const { data: lFrom } = await db.from("stock_levels")
      .select("quantity")
      .eq("product_id", product_id)
      .eq("warehouse_id", from_warehouse_id)
      .maybeSingle()
    const cur = Number(lFrom?.quantity ?? 0)
    await db.from("stock_levels").upsert(
      { product_id, warehouse_id: from_warehouse_id, quantity: Math.max(0, cur - quantity) },
      { onConflict: "product_id,warehouse_id" }
    )
  }

  if (needsTo && to_warehouse_id) {
    const { data: lTo } = await db.from("stock_levels")
      .select("quantity")
      .eq("product_id", product_id)
      .eq("warehouse_id", to_warehouse_id)
      .maybeSingle()
    const cur = Number(lTo?.quantity ?? 0)
    await db.from("stock_levels").upsert(
      { product_id, warehouse_id: to_warehouse_id, quantity: cur + quantity },
      { onConflict: "product_id,warehouse_id" }
    )
  }

  return NextResponse.json({ ok: true })
}
