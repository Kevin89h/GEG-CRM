import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import DealsClient from "./DealsClient"

export default async function DealsPage() {
  const { supabase, db } = await createCompanyClient()
  const authClient = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: deals }, { data: accounts }, { data: profiles }] = await Promise.all([
    db.from("deals").select("*, account:accounts(id, name, type)").order("created_at", { ascending: false }),
    db.from("accounts").select("id, name").order("name"),
    authClient.from("profiles").select("id, full_name, email").order("full_name"),
  ])

  return (
    <DealsClient
      deals={deals ?? []}
      accounts={accounts ?? []}
      profiles={(profiles ?? []) as { id: string; full_name: string | null; email: string }[]}
      currentUserId={user?.id ?? ""}
    />
  )
}
