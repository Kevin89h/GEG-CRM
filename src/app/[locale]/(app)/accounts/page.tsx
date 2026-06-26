import { createCompanyClient } from "@/lib/company"
import AccountsClient from "./AccountsClient"

export default async function AccountsPage() {
  const { db: supabase } = await createCompanyClient()

  const [{ data: accounts }, { data: employees }] = await Promise.all([
    supabase.from("accounts").select("*, contacts(count), deals(count), salesperson_id").order("name"),
    supabase.from("employees").select("id, full_name").eq("is_active", true).order("full_name"),
  ])

  return <AccountsClient accounts={accounts ?? []} employees={employees ?? []} />
}
