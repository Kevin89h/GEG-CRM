import { createCompanyClient } from "@/lib/company"
import AchatsClient from "./AchatsClient"

export default async function AchatsPage() {
  const { db } = await createCompanyClient()

  const { data: orders } = await db
    .from("purchase_orders")
    .select("id, number, supplier_name, status, currency, order_date, expected_date, user_id, lines:purchase_order_lines(quantity, fob_unit_price)")
    .order("created_at", { ascending: false })

  type RawOrder = {
    id: string
    number: string
    supplier_name: string
    status: string
    currency: string
    order_date: string | null
    expected_date: string | null
    user_id: string | null
    lines: { quantity: number; fob_unit_price: number }[]
  }

  const list = ((orders ?? []) as unknown as RawOrder[]).map(o => {
    const total = (o.lines ?? []).reduce(
      (s, l) => s + l.quantity * l.fob_unit_price,
      0
    )
    return {
      id: o.id,
      number: o.number,
      supplier_name: o.supplier_name,
      status: o.status,
      currency: o.currency,
      order_date: o.order_date,
      expected_date: o.expected_date,
      user_id: o.user_id,
      total,
    }
  })

  return <AchatsClient orders={list} />
}
