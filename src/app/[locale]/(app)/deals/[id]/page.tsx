import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import DealDetailClient from "./DealDetailClient"

export default async function DealDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params
  const { db, schema } = await createCompanyClient()
  const authClient = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deal: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let accounts: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let activities: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let linkedDevis: any[] = []

  if (schema === "geg_singapore") {
    const admin = createAdminClient()
    const [{ data: sgDeal }, { data: sgAccounts }] = await Promise.all([
      admin.rpc("get_singapore_deal", { p_id: id }),
      admin.rpc("get_singapore_deals"),
    ])
    deal = sgDeal
    accounts = (sgAccounts ?? []).map((d: any) => ({ id: d.id, name: d.account_name }))
  } else {
    const [{ data: guDeal }, { data: guAccounts }, { data: guActivities }, { data: guDevis }] = await Promise.all([
      db.from("deals").select("*, account:accounts(id, name, type)").eq("id", id).single(),
      db.from("accounts").select("id, name").order("name"),
      db.from("activities")
        .select("id, type, subject, notes, date, follow_up_date, completed, user_id")
        .eq("deal_id", id)
        .order("date", { ascending: false }),
      db.from("sales_orders")
        .select("id, number, status, total_ttc, currency, created_at, account:accounts(id, name)")
        .eq("deal_id", id)
        .order("created_at", { ascending: false }),
    ])
    deal = guDeal
    accounts = guAccounts ?? []
    activities = guActivities ?? []
    linkedDevis = guDevis ?? []
  }

  if (!deal) notFound()

  const assignedIds: string[] = Array.isArray(deal.assigned_to) ? deal.assigned_to : deal.assigned_to ? [deal.assigned_to] : []

  const { data: profiles } = await authClient.from("profiles").select("id, full_name, email").order("full_name")
  const { data: assignedProfiles } = assignedIds.length > 0
    ? await authClient.from("profiles").select("id, full_name, email").in("id", assignedIds)
    : { data: [] }

  const normalizedDeal = {
    ...deal,
    assigned_to: assignedIds,
    account: Array.isArray(deal.account) ? deal.account[0] ?? null : deal.account,
    assignedEmployees: (assignedProfiles ?? []) as { id: string; full_name: string | null; email: string }[],
  }

  return (
    <DealDetailClient
      deal={normalizedDeal}
      activities={activities}
      profiles={(profiles ?? []) as { id: string; full_name: string | null; email: string }[]}
      accounts={accounts}
      linkedDevis={linkedDevis}
      schema={schema}
    />
  )
}
