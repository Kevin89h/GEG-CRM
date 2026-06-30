import { createCompanyClient } from "@/lib/company"
import NouvelleFactureFournisseurClient from "./NouvelleFactureFournisseurClient"

export default async function NouvelleFactureFournisseurPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db } = await createCompanyClient()

  const { data: treasuryAccounts } = await db
    .from("treasury_accounts")
    .select("id, name, type, currency")
    .eq("is_active", true)
    .order("name")

  return (
    <NouvelleFactureFournisseurClient
      locale={locale}
      treasuryAccounts={treasuryAccounts ?? []}
    />
  )
}
