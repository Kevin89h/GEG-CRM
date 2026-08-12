import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createCompanyClient } from "@/lib/company"
import AccountsClient from "./AccountsClient"
import type { Account } from "@/types"

type AccountRow = Account & { contacts: [{ count: number }]; deals: [{ count: number }]; salesperson_id?: string | null }
type EmployeeRow = { id: string; full_name: string }

export default async function AccountsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: profile } = await supabaseAuth.from("profiles").select("role, permissions").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    const perm = profile?.permissions?.accounts
    if (perm && !perm.view) redirect(`/${locale}/dashboard`)
  }

  const { db } = await createCompanyClient()

  const [acctRes, empRes] = await Promise.all([
    db.from("accounts").select("id, name, type, industry, country, salesperson_id, contacts(count), deals(count)").order("name"),
    db.from("employees").select("id, full_name").eq("is_active", true).order("full_name"),
  ])

  return (
    <AccountsClient
      accounts={(acctRes.data ?? []) as AccountRow[]}
      employees={(empRes.data ?? []) as EmployeeRow[]}
    />
  )
}
