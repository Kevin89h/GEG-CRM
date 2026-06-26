import { createCompanyClient } from "@/lib/company"
import DealsClient from "./DealsClient"

export default async function DealsPage() {
  const { supabase, db } = await createCompanyClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: deals }, { data: accounts }, { data: profiles }] = await Promise.all([
    supabase
      .from("deals")
      .select("*, account:accounts(id, name, type)")
      .order("created_at", { ascending: false }),
    db.from("accounts").select("id, name").order("name"),
    db.from("profiles").select("id, full_name, email"),
  ])

  return (
    <DealsClient
      deals={deals ?? []}
      accounts={accounts ?? []}
      profiles={profiles ?? []}
      currentUserId={user?.id ?? ""}
    />
  )
}
