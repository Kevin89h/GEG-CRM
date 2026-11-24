import { createCompanyClient } from "@/lib/company"
import { getMarketRates } from "@/lib/fx"
import FacturesClient from "./FacturesClient"

export default async function FacturesPage() {
  const { db, schema } = await createCompanyClient()

  const [{ data: invoices }, { data: accounts }, { data: deliveryStates }] = await Promise.all([
    db.from("invoice_totals")
      .select("id, number, status, currency, account_id, issue_date, due_date, total_ht, total_paid, balance")
      .order("issue_date", { ascending: false }),
    db.from("accounts").select("id, name"),
    // A1: delivery state of every invoice (full history, no limit)
    db.from("invoice_delivery_status").select("invoice_id, delivery_state").limit(100000),
  ])
  const deliveryState = new Map(((deliveryStates ?? []) as { invoice_id: string; delivery_state: string }[]).map(d => [d.invoice_id, d.delivery_state]))

  const accountMap: Record<string, string> = {}
  for (const a of accounts ?? []) accountMap[a.id] = a.name

  type RawInvoice = {
    id: string; number: string; status: string; currency: string
    account_id: string | null; issue_date: string | null; due_date: string | null
    total_ht: number | string; total_paid: number | string; balance: number | string
  }

  const list = ((invoices ?? []) as unknown as RawInvoice[]).map(i => ({
    id: i.id,
    number: i.number,
    status: i.status,
    currency: i.currency,
    account_id: i.account_id,
    issue_date: i.issue_date,
    due_date: i.due_date,
    total_ht: Number(i.total_ht),
    total_paid: Number(i.total_paid),
    balance: Number(i.balance),
    client_name: i.account_id ? (accountMap[i.account_id] ?? "—") : "—",
    delivery_state: deliveryState.get(i.id) ?? null,
  }))

  // G1 / D-01: market rates for the indicative EUR total of the multi-currency summaries
  const fx = await getMarketRates()
  return <FacturesClient fx={fx} invoices={list} schema={schema} />
}
