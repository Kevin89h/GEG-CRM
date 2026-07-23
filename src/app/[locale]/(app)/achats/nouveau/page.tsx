import { createCompanyClient } from "@/lib/company"
import NouvelAchatClient from "./NouvelAchatClient"

export default async function NouvelAchatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db: supabase } = await createCompanyClient()
  const [{ data: products }, { data: supplierRows }] = await Promise.all([
    supabase.from("products").select("id, name, reference, buy_price").eq("is_active", true).order("name"),
    supabase.from("purchase_orders").select("supplier_name").order("supplier_name"),
  ])
  const suppliers = [...new Set((supplierRows ?? []).map((r: { supplier_name: string }) => r.supplier_name).filter(Boolean))].sort()
  return <NouvelAchatClient products={products ?? []} suppliers={suppliers} locale={locale} />
}
