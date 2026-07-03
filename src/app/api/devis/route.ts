import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

interface DevisLine {
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  discount: number
  position: number
  tva_exempt: boolean
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { order: orderData, lines, user_id } = body as {
    order: Record<string, unknown>
    lines: DevisLine[]
    user_id: string
  }

  const { db } = await createCompanyClient()

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const { count } = await db.from("sales_orders").select("*", { count: "exact", head: true })
  const seq = String((count ?? 0) + 1).padStart(4, "0")
  const number = `DEV-${year}-${month}-${seq}`

  const { data: order, error: orderErr } = await db.from("sales_orders").insert([{
    ...orderData,
    number,
    user_id,
  }]).select("id").single()

  if (orderErr || !order) return NextResponse.json({ error: orderErr?.message ?? "Erreur création devis" }, { status: 400 })

  if (lines.length > 0) {
    const { error: lineErr } = await db.from("sales_order_lines").insert(
      lines.map(l => ({ ...l, order_id: order.id }))
    )
    if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 400 })
  }

  return NextResponse.json({ id: order.id })
}
