import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import DealsClient from "./DealsClient"

export default async function DealsPage() {
  const { supabase, db, schema } = await createCompanyClient()
  const authClient = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let deals: any[] = []
  let accounts: any[] = []

  if (schema === "geg_singapore") {
    const admin = createAdminClient()
    const [{ data: sgDeals }, { data: sgAccounts }] = await Promise.all([
      admin.rpc("get_singapore_deals"),
      (admin as any).schema("geg_singapore").from("accounts").select("id, name").order("name"),
    ])
    // Normalize Singapore deals to match the shape DealsClient expects
    deals = (sgDeals ?? []).map((d: any) => ({
      ...d,
      stage: d.stage ?? "lead",
      priority: "normal",
      value: null,
      currency: "USD",
      assigned_to: [],
      account: { id: null, name: d.account_name, type: null },
    }))
    accounts = sgAccounts ?? []
  } else {
    const [{ data: guDeals }, { data: guAccounts }] = await Promise.all([
      db.from("deals").select("*, account:accounts(id, name, type)").order("created_at", { ascending: false }),
      db.from("accounts").select("id, name").order("name"),
    ])
    deals = guDeals ?? []
    accounts = guAccounts ?? []
  }

  const { data: profiles } = await authClient.from("profiles").select("id, full_name, email").order("full_name")

  return (
    <DealsClient
      deals={deals}
      accounts={accounts}
      profiles={(profiles ?? []) as { id: string; full_name: string | null; email: string }[]}
      currentUserId={user?.id ?? ""}
    />
  )
}
