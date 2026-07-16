import { createCompanyClient } from "@/lib/company"
import { notFound } from "next/navigation"
import DealDetailClient from "./DealDetailClient"

export default async function DealDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()

  const { data: deal } = await db
    .from("deals")
    .select("*, account:accounts(id, name, type)")
    .eq("id", id)
    .single()

  if (!deal) notFound()

  const assignedIds: string[] = Array.isArray(deal.assigned_to) ? deal.assigned_to : deal.assigned_to ? [deal.assigned_to] : []

  const [
    { data: activities },
    { data: employees },
    { data: accounts },
    { data: assignedEmployees },
  ] = await Promise.all([
    db.from("activities")
      .select("id, type, subject, notes, date, follow_up_date, completed, user_id")
      .eq("deal_id", id)
      .order("date", { ascending: false }),
    db.from("employees").select("id, full_name").eq("is_active", true).order("full_name"),
    db.from("accounts").select("id, name").order("name"),
    assignedIds.length > 0
      ? db.from("employees").select("id, full_name").in("id", assignedIds)
      : Promise.resolve({ data: [] }),
  ])

  const normalizedDeal = {
    ...deal,
    assigned_to: assignedIds,
    account: Array.isArray(deal.account) ? deal.account[0] ?? null : deal.account,
    assignedEmployees: (assignedEmployees ?? []) as { id: string; full_name: string }[],
  }

  return (
    <DealDetailClient
      deal={normalizedDeal}
      activities={activities ?? []}
      employees={employees ?? []}
      accounts={accounts ?? []}
    />
  )
}
