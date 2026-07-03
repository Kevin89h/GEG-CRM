import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

interface OrderLine {
  product_id: string | null
  description: string
  quantity: number
  fob_unit_price: number
  position: number
}

interface Cost {
  type: string
  label: string
  amount: number
  currency: string
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { order: orderData, lines, costs, user_id } = body as {
    order: Record<string, unknown>
    lines: OrderLine[]
    costs: Cost[]
    user_id: string
  }

  const { db } = await createCompanyClient()

  const { count } = await db.from("purchase_orders").select("id", { count: "exact", head: true })
  const num = `PO-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}-${Date.now().toString().slice(-4)}`

  const { data: order, error: orderErr } = await db.from("purchase_orders").insert([{
    ...orderData,
    number: num,
    user_id,
  }]).select("id").single()

  if (orderErr || !order) return NextResponse.json({ error: orderErr?.message ?? "Erreur création" }, { status: 400 })

  if (lines.length > 0) {
    const { error: lineErr } = await db.from("purchase_order_lines").insert(
      lines.map(l => ({ ...l, order_id: order.id }))
    )
    if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 400 })
  }

  if (costs.length > 0) {
    const { error: costErr } = await db.from("purchase_costs").insert(
      costs.map(c => ({ ...c, order_id: order.id }))
    )
    if (costErr) return NextResponse.json({ error: costErr.message }, { status: 400 })
  }

  return NextResponse.json({ id: order.id })
}
