import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import { notFound } from "next/navigation"
import FacturePrintPage from "./FacturePrintPage"

export default async function FacturePdfPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()
  const publicSupa = await createClient()
  const schema = await getCompanySchema()
  const { data: company } = await publicSupa.from("companies").select("id").eq("schema_name", schema).single()
  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const { data: invoice } = await db
    .from("invoices")
    .select(`
      id, number, status, currency, issue_date, due_date, notes,
      account:accounts(id, name, country),
      lines:invoice_lines(id, description, quantity, unit_price, discount, position, product:products(name, reference))
    `)
    .eq("id", id)
    .single()

  if (!invoice) notFound()

  const account = Array.isArray(invoice.account) ? invoice.account[0] : invoice.account
  const lines = ((invoice.lines ?? []) as Record<string, unknown>[])
    .sort((a, b) => (a.position as number) - (b.position as number))
    .map(l => ({
      id: String(l.id ?? ""),
      description: String(l.description ?? ""),
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unit_price) || 0,
      discount: Number(l.discount) || 0,
      product: Array.isArray(l.product) ? (l.product[0] ?? null) : (l.product as { name: string; reference: string | null } | null),
    }))

  return (
    <FacturePrintPage
      number={invoice.number}
      status={invoice.status}
      currency={invoice.currency}
      issueDate={invoice.issue_date}
      dueDate={invoice.due_date ?? null}
      notes={invoice.notes ?? null}
      accountName={(account as Record<string, string> | null)?.name ?? "—"}
      accountCountry={(account as Record<string, string> | null)?.country ?? null}
      lines={lines}
      locale={locale}
      docSettings={docSettings ?? null}
    />
  )
}
