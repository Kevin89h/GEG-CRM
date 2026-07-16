import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import DealDetailClient from "./DealDetailClient"

export default async function DealDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()
  const authClient = await createClient()

  const { data: deal } = await db
    .from("deals")
    .select("*, account:accounts(id, name, type)")
    .eq("id", id)
    .single()

  if (!deal) notFound()

  const assignedIds: string[] = Array.isArray(deal.assigned_to) ? deal.assigned_to : deal.assigned_to ? [deal.assigned_to] : []

  const [
    { data: activities },
    { data: profiles },
    { data: accounts },
    { data: assignedProfiles },
  ] = await Promise.all([
    db.from("activities")
      .select("id, type, subject, notes, date, follow_up_date, completed, user_id")
      .eq("deal_id", id)
      .order("date", { ascending: false }),
    authClient.from("profiles").select("id, full_name, email").order("full_name"),
    db.from("accounts").select("id, name").order("name"),
    assignedIds.length > 0
      ? authClient.from("profiles").select("id, full_name, email").in("id", assignedIds)
      : Promise.resolve({ data: [] }),
  ])

  const normalizedDeal = {
    ...deal,
    assigned_to: assignedIds,
    account: Array.isArray(deal.account) ? deal.account[0] ?? null : deal.account,
    assignedEmployees: (assignedProfiles ?? []) as { id: string; full_name: string | null; email: string }[],
  }

  return (
    <DealDetailClient
      deal={normalizedDeal}
      activities={activities ?? []}
      profiles={(profiles ?? []) as { id: string; full_name: string | null; email: string }[]}
      accounts={accounts ?? []}
    />
  )
}
