import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createCompanyClient } from "@/lib/company"
import AccountsClient from "./AccountsClient"

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

  const { db: supabase } = await createCompanyClient()

  const [{ data: accounts }, { data: employees }] = await Promise.all([
    supabase.from("accounts").select("*, contacts(count), deals(count), salesperson_id").order("name"),
    supabase.from("employees").select("id, full_name").eq("is_active", true).order("full_name"),
  ])

  return <AccountsClient accounts={accounts ?? []} employees={employees ?? []} />
}
