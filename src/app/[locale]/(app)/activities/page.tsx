import { createCompanyClient } from "@/lib/company"
import ActivitiesClient from "./ActivitiesClient"

export default async function ActivitiesPage() {
  const { supabase, db } = await createCompanyClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: activities }, { data: accounts }, { data: deals }] = await Promise.all([
    supabase
      .from("activities")
      .select("*, account:accounts(id, name), deal:deals(id, title), contact:contacts(id, first_name, last_name)")
      .order("date", { ascending: false }),
    db.from("accounts").select("id, name").order("name"),
    db.from("deals").select("id, title").order("title"),
  ])

  return (
    <ActivitiesClient
      activities={activities ?? []}
      accounts={accounts ?? []}
      deals={deals ?? []}
      currentUserId={user?.id ?? ""}
    />
  )
}
