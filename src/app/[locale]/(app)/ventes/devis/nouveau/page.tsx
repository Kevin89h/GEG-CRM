import { createCompanyClient } from "@/lib/company"
import NouveauDevisClient from "./NouveauDevisClient"

export default async function NouveauDevisPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db: supabase } = await createCompanyClient()

  const [{ data: accounts }, { data: contacts }, { data: products }, { data: employees }, { data: units }] = await Promise.all([
    supabase.from("accounts").select("id, name, salesperson_id").order("name"),
    supabase.from("contacts").select("id, first_name, last_name, account_id").order("last_name"),
    supabase.from("products").select("id, name, reference, sell_price, currency, unit:units(id, name)").eq("is_active", true).order("name"),
    supabase.from("employees").select("id, full_name, commission_rate").eq("is_active", true).order("full_name"),
    supabase.from("units").select("id, name, type").order("name"),
  ])

  return (
    <NouveauDevisClient
      accounts={(accounts ?? []) as { id: string; name: string; salesperson_id: string | null }[]}
      contacts={contacts ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products={(products ?? []) as any}
      employees={(employees ?? []) as { id: string; full_name: string; commission_rate: number }[]}
      units={(units ?? []) as { id: string; name: string; type: string }[]}
      locale={locale}
    />
  )
}
