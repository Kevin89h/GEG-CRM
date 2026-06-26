import { createCompanyClient } from "@/lib/company"
import DevisClient from "./DevisClient"

export default async function DevisListPage() {
  const { db } = await createCompanyClient()

  const [
    { data: orders },
    { data: accounts },
    { data: employees },
  ] = await Promise.all([
    db.from("sales_order_totals")
      .select("id, number, status, currency, account_id, created_at, total_ht, salesperson_id")
      .order("created_at", { ascending: false }),
    db.from("accounts").select("id, name"),
    db.from("employees").select("id, full_name"),
  ])

  const accountMap: Record<string, string> = {}
  for (const a of accounts ?? []) accountMap[a.id] = a.name
  const employeeMap: Record<string, string> = {}
  for (const e of employees ?? []) employeeMap[e.id] = e.full_name

  type RawOrder = {
    id: string; number: string; status: string; currency: string
    account_id: string | null; created_at: string; total_ht: number | string
    salesperson_id: string | null
  }

  const list = ((orders ?? []) as unknown as RawOrder[]).map(o => ({
    id: o.id,
    number: o.number,
    status: o.status,
    currency: o.currency,
    account_id: o.account_id,
    created_at: o.created_at,
    total_ht: Number(o.total_ht),
    salesperson_id: o.salesperson_id,
    client_name: o.account_id ? (accountMap[o.account_id] ?? "—") : "—",
    salesperson_name: o.salesperson_id ? (employeeMap[o.salesperson_id] ?? "—") : "—",
  }))

  return <DevisClient orders={list} />
}
