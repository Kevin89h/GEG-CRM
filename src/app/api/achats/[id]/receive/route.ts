import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

interface StockMove {
  type: "in"
  product_id: string | null
  to_warehouse_id: string | null
  quantity: number
  notes: string
  user_id: string
}

interface ProductUpdate {
  product_id: string
  buy_price: number
  buy_price_currency: string
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { stockMoves, productUpdates } = body as {
    stockMoves: StockMove[]
    productUpdates: ProductUpdate[]
  }

  const { db } = await createCompanyClient()

  if (stockMoves.length > 0) {
    const { error: moveErr } = await db.from("stock_moves").insert(stockMoves)
    if (moveErr) return NextResponse.json({ error: `stock_moves: ${moveErr.message}` }, { status: 400 })

    // Update stock_levels for each "in" move
    for (const m of stockMoves) {
      if (!m.product_id || !m.to_warehouse_id) continue
      const { data: level } = await db
        .from("stock_levels")
        .select("quantity")
        .eq("product_id", m.product_id)
        .eq("warehouse_id", m.to_warehouse_id)
        .maybeSingle()
      const current = Number(level?.quantity ?? 0)
      await db.from("stock_levels").upsert(
        { product_id: m.product_id, warehouse_id: m.to_warehouse_id, quantity: current + m.quantity },
        { onConflict: "product_id,warehouse_id" }
      )
    }
  }

  for (const u of productUpdates) {
    await db.from("products").update({
      buy_price: u.buy_price,
      buy_price_currency: u.buy_price_currency,
    }).eq("id", u.product_id)
  }

  const { error: orderErr } = await db.from("purchase_orders").update({ status: "received" }).eq("id", id)
  if (orderErr) return NextResponse.json({ error: `purchase_orders: ${orderErr.message}` }, { status: 400 })

  return NextResponse.json({ ok: true })
}
