import { createCompanyClient } from "@/lib/company"
import DealsClient from "./DealsClient"

export default async function DealsPage() {
  const { supabase, db } = await createCompanyClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: deals }, { data: accounts }, { data: employees }] = await Promise.all([
    db.from("deals").select("*, account:accounts(id, name, type)").order("created_at", { ascending: false }),
    db.from("accounts").select("id, name").order("name"),
    db.from("employees").select("id, full_name").eq("is_active", true).order("full_name"),
  ])

  return (
    <DealsClient
      deals={deals ?? []}
      accounts={accounts ?? []}
      employees={employees ?? []}
      currentUserId={user?.id ?? ""}
    />
  )
}
