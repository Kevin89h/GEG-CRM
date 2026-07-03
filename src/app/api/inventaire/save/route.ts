import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

interface AdjustmentItem {
  product_id: string
  warehouse_id: string
  newQuantity: number
  currentQuantity: number
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { adjustments, user_id } = body as { adjustments: AdjustmentItem[]; user_id: string }

  const { db } = await createCompanyClient()
  const errors: string[] = []

  for (const item of adjustments) {
    const delta = item.newQuantity - item.currentQuantity
    if (delta === 0) continue

    const { error: moveErr } = await db.from("stock_moves").insert([{
      type: "adjustment",
      product_id: item.product_id,
      quantity: Math.abs(delta),
      notes: `Inventaire: ${item.currentQuantity} → ${item.newQuantity}`,
      to_warehouse_id: item.warehouse_id,
      from_warehouse_id: null,
      user_id,
    }])
    if (moveErr) { errors.push(moveErr.message); continue }

    const { error: levelErr } = await db.from("stock_levels").upsert(
      { product_id: item.product_id, warehouse_id: item.warehouse_id, quantity: item.newQuantity },
      { onConflict: "product_id,warehouse_id" }
    )
    if (levelErr) errors.push(levelErr.message)
  }

  if (errors.length > 0) return NextResponse.json({ error: errors.join("; ") }, { status: 400 })
  return NextResponse.json({ ok: true, count: adjustments.length })
}
