import { createCompanyClient } from "@/lib/company"
import DealsDashboardClient from "./DealsDashboardClient"

export default async function DealsDashboardPage() {
  const { db } = await createCompanyClient()

  const [{ data: allDeals }, { data: wonWithInvoice }] = await Promise.all([
    db.from("deals")
      .select("id, title, stage, selling_price, cost, currency, account:accounts(id, name), prospect_name, created_at")
      .order("created_at", { ascending: false }),
    db.from("deals")
      .select("id, title, selling_price, cost, currency, account:accounts(id, name), prospect_name, created_at, invoice:invoices!deal_id(id, number, status, total_ht, currency)")
      .eq("stage", "won")
      .order("created_at", { ascending: false }),
  ])

  return (
    <DealsDashboardClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allDeals={(allDeals ?? []) as any[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wonDeals={(wonWithInvoice ?? []) as any[]}
    />
  )
}
