import { createCompanyClient } from "@/lib/company"
import FournisseursAchatsClient from "./FournisseursAchatsClient"

export default async function FournisseursAchatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db } = await createCompanyClient()

  const [{ data: suppliers }, { data: orderStats }] = await Promise.all([
    db.from("suppliers").select("id, name, email, phone, country, city, payment_terms, currency, iban, swift, bank_name, notes, is_active").eq("is_active", true).order("name"),
    db.from("purchase_orders").select("supplier_id, total").not("supplier_id", "is", null),
  ])

  const statsBySupplier: Record<string, { count: number; total: Record<string, number> }> = {}
  for (const row of orderStats ?? []) {
    if (!row.supplier_id) continue
    if (!statsBySupplier[row.supplier_id]) statsBySupplier[row.supplier_id] = { count: 0, total: {} }
    statsBySupplier[row.supplier_id].count++
    // total is stored without currency in this aggregate — we just sum as number
    statsBySupplier[row.supplier_id].total["ALL"] = (statsBySupplier[row.supplier_id].total["ALL"] ?? 0) + (row.total ?? 0)
  }

  const suppliersWithStats = (suppliers ?? []).map(s => ({
    ...s,
    order_count: statsBySupplier[s.id]?.count ?? 0,
    order_total: statsBySupplier[s.id]?.total["ALL"] ?? 0,
  }))

  return <FournisseursAchatsClient suppliers={suppliersWithStats} locale={locale} />
}
