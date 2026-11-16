import { createCompanyClient } from "@/lib/company"
import { getMarketRates } from "@/lib/fx"
import FacturesFournisseursListClient from "./FacturesFournisseursListClient"

export default async function FacturesFournisseursPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db } = await createCompanyClient()

  const { data: invoices } = await db
    .from("supplier_invoice_totals")
    .select("id, number, supplier_name, status, currency, total_ht, total_ttc, balance, invoice_date, due_date")
    .order("invoice_date", { ascending: false })
    .limit(500)

  // G1 / D-01: market rates for the indicative EUR total of the multi-currency summaries
  const fx = await getMarketRates()
  return <FacturesFournisseursListClient fx={fx} invoices={invoices ?? []} locale={locale} />
}
