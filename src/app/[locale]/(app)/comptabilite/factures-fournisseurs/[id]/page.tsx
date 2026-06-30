import { createCompanyClient } from "@/lib/company"
import { notFound } from "next/navigation"
import FactureFournisseurDetailClient from "./FactureFournisseurDetailClient"

export default async function FactureFournisseurDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()

  const { data: invoice } = await db
    .from("supplier_invoices")
    .select("*")
    .eq("id", id)
    .single()

  if (!invoice) notFound()

  const { data: lines } = await db
    .from("supplier_invoice_lines")
    .select("*")
    .eq("invoice_id", id)
    .order("position")

  return (
    <FactureFournisseurDetailClient
      invoice={invoice}
      lines={lines ?? []}
      locale={locale}
    />
  )
}
