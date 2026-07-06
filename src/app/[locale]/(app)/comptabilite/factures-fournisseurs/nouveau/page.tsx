import { createCompanyClient } from "@/lib/company"
import NouvelleFactureFournisseurClient from "./NouvelleFactureFournisseurClient"

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string>>
}

export default async function NouvelleFactureFournisseurPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const sp = await searchParams
  const { db } = await createCompanyClient()

  const { data: treasuryAccounts } = await db
    .from("treasury_accounts")
    .select("id, name, type, currency")
    .eq("is_active", true)
    .order("name")

  // Pré-remplissage depuis un bon de commande
  const prefill = sp.order_id ? {
    order_id: sp.order_id,
    reception_id: sp.reception_id ?? null,
    supplier: sp.supplier ?? "",
    currency: sp.currency ?? "GNF",
    reference: sp.reference ?? "",
  } : null

  return (
    <NouvelleFactureFournisseurClient
      locale={locale}
      treasuryAccounts={treasuryAccounts ?? []}
      prefill={prefill}
    />
  )
}
