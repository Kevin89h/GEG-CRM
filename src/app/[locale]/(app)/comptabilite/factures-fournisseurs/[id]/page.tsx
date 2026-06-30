import { createCompanyClient } from "@/lib/company"
import { notFound } from "next/navigation"
import FactureFournisseurDetailClient from "./FactureFournisseurDetailClient"

export default async function FactureFournisseurDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()

  const [{ data: invoice }, { data: lines }, { data: payments }, { data: treasuryAccounts }] = await Promise.all([
    db.from("supplier_invoices").select("*").eq("id", id).single(),
    db.from("supplier_invoice_lines").select("*").eq("invoice_id", id).order("position"),
    db.from("supplier_payments").select("*").eq("supplier_invoice_id", id).order("paid_at", { ascending: false }),
    db.from("treasury_accounts").select("id, name, type, currency").eq("is_active", true).order("name"),
  ])

  if (!invoice) notFound()

  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const balance = Number(invoice.total_ttc) - totalPaid

  return (
    <FactureFournisseurDetailClient
      invoice={{ ...invoice, total_paid: totalPaid, balance }}
      lines={lines ?? []}
      payments={payments ?? []}
      treasuryAccounts={treasuryAccounts ?? []}
      locale={locale}
    />
  )
}
