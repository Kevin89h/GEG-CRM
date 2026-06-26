import { createCompanyClient } from "@/lib/company"
import NouvelleFactureClient from "./NouvelleFactureClient"

export default async function NouvelleFacturePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db } = await createCompanyClient()

  const [{ data: accounts }, { data: products }, { data: treasuryAccounts }] = await Promise.all([
    db.from("accounts").select("id, name").order("name"),
    db.from("products").select("id, name, reference, sell_price, currency").eq("is_active", true).order("name"),
    db.from("treasury_accounts").select("id, name, type, currency").eq("is_active", true).order("name"),
  ])

  return (
    <NouvelleFactureClient
      locale={locale}
      accounts={accounts ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products={(products ?? []) as any}
      treasuryAccounts={treasuryAccounts ?? []}
    />
  )
}
