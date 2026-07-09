import { createCompanyClient } from "@/lib/company"
import FacturesFournisseursListClient from "./FacturesFournisseursListClient"

export default async function FacturesFournisseursPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db } = await createCompanyClient()

  const { data: invoices } = await db
    .from("supplier_invoice_totals")
    .select("id, number, supplier_name, status, currency, total_ht, total_ttc, balance, invoice_date, due_date")
    .order("invoice_date", { ascending: false })
    .limit(500)

  return <FacturesFournisseursListClient invoices={invoices ?? []} locale={locale} />
}
