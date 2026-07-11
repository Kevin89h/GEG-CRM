import { createCompanyClient } from "@/lib/company"
import AchatsClient from "./AchatsClient"

export default async function AchatsPage() {
  const { db } = await createCompanyClient()

  const [{ data: orders }, { data: invoices }] = await Promise.all([
    db.from("purchase_orders")
      .select("id, number, supplier_name, status, currency, order_date, expected_date, user_id, lines:purchase_order_lines(quantity, fob_unit_price)")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
    db.from("supplier_invoices")
      .select("id, number, purchase_order_id, status")
      .not("purchase_order_id", "is", null),
  ])

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

  type InvoiceRef = { id: string; number: string; purchase_order_id: string; status: string }
  const invoicesByPO = new Map<string, InvoiceRef>()
  for (const inv of (invoices ?? []) as unknown as InvoiceRef[]) {
    if (inv.purchase_order_id && !invoicesByPO.has(inv.purchase_order_id)) {
      invoicesByPO.set(inv.purchase_order_id, inv)
    }
  }

  const list = ((orders ?? []) as unknown as RawOrder[]).map(o => {
    const total = (o.lines ?? []).reduce(
      (s, l) => s + l.quantity * l.fob_unit_price,
      0
    )
    const invoice = invoicesByPO.get(o.id) ?? null
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
      invoice,
    }
  })

  return <AchatsClient orders={list} />
}
