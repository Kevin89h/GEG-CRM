import { createCompanyClient } from "@/lib/company"
import { notFound } from "next/navigation"
import FactureFournisseurDetailClient from "./FactureFournisseurDetailClient"

export default async function FactureFournisseurDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()

  const [{ data: invoice }, { data: lines }, { data: payments }, { data: treasuryAccounts }, { data: exchangeRates }] = await Promise.all([
    db.from("supplier_invoices").select("*").eq("id", id).single(),
    db.from("supplier_invoice_lines").select("*").eq("invoice_id", id).order("position"),
    db.from("supplier_payments").select("*").eq("supplier_invoice_id", id).order("paid_at", { ascending: false }),
    db.from("treasury_accounts").select("id, name, type, currency").eq("is_active", true).order("name"),
    db.from("exchange_rates").select("from_currency, to_currency, rate, effective_date").order("effective_date", { ascending: false }),
  ])

  if (!invoice) notFound()

  const invoiceCurrency = invoice.currency ?? "GNF"
  const totalPaid = (payments ?? []).reduce((s, p) => {
    const amt = Number(p.amount)
    if (p.currency && p.currency !== invoiceCurrency && p.exchange_rate) {
      return s + amt / Number(p.exchange_rate)
    }
    return s + amt
  }, 0)
  const balance = Number(invoice.total_ttc) - totalPaid

  return (
    <FactureFournisseurDetailClient
      invoice={{ ...invoice, total_paid: totalPaid, balance }}
      lines={lines ?? []}
      payments={payments ?? []}
      treasuryAccounts={treasuryAccounts ?? []}
      exchangeRates={exchangeRates ?? []}
      locale={locale}
    />
  )
}
