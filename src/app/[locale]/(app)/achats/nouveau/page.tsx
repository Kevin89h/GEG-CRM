import { createCompanyClient } from "@/lib/company"
import NouvelAchatClient from "./NouvelAchatClient"

export default async function NouvelAchatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db: supabase } = await createCompanyClient()
  const [{ data: products }, { data: suppliersData }] = await Promise.all([
    supabase.from("products").select("id, name, reference, buy_price").eq("is_active", true).order("name"),
    supabase.from("suppliers").select("id, name, currency, payment_terms").eq("is_active", true).order("name"),
  ])
  const suppliers = (suppliersData ?? []).map(s => ({
    id: s.id,
    name: s.name,
    currency: s.currency ?? "USD",
    payment_terms: s.payment_terms ?? null,
  }))
  return <NouvelAchatClient products={products ?? []} suppliers={suppliers} locale={locale} />
}
