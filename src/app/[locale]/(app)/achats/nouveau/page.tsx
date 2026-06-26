import { createCompanyClient } from "@/lib/company"
import NouvelAchatClient from "./NouvelAchatClient"

export default async function NouvelAchatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db: supabase } = await createCompanyClient()
  const { data: products } = await supabase
    .from("products").select("id, name, reference, buy_price").eq("is_active", true).order("name")
  return <NouvelAchatClient products={products ?? []} locale={locale} />
}
