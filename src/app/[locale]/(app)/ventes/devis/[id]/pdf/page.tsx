import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import { notFound } from "next/navigation"
import PrintPage from "./PrintPage"

export default async function DevisPdfPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()
  const publicSupa = await createClient()
  const schema = await getCompanySchema()
  const { data: company } = await publicSupa.from("companies").select("id").eq("schema_name", schema).single()
  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const { data: order } = await db
    .from("sales_orders")
    .select(`
      id, number, status, currency, valid_until, notes, created_at, delivery_address, payment_terms,
      account:accounts(id, name, country),
      salesperson:employees(full_name),
      lines:sales_order_lines(id, description, quantity, unit_price, discount, position, product:products(name, reference))
    `)
    .eq("id", id)
    .single()

  if (!order) notFound()

  const account = Array.isArray(order.account) ? order.account[0] : order.account
  const salesperson = Array.isArray(order.salesperson) ? order.salesperson[0] : order.salesperson
  const lines = ((order.lines ?? []) as Record<string, unknown>[])
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
    <PrintPage
      number={order.number}
      status={order.status}
      currency={order.currency}
      createdAt={order.created_at}
      validUntil={(order as Record<string, unknown>).valid_until as string ?? null}
      notes={(order as Record<string, unknown>).notes as string ?? null}
      deliveryAddress={(order as Record<string, unknown>).delivery_address as string ?? null}
      paymentTerms={(order as Record<string, unknown>).payment_terms as string ?? null}
      accountName={(account as Record<string, string> | null)?.name ?? "—"}
      accountCountry={(account as Record<string, string> | null)?.country ?? null}
      salespersonName={(salesperson as Record<string, string> | null)?.full_name ?? null}
      lines={lines}
      locale={locale}
      docType="devis"
      docSettings={docSettings ?? null}
    />
  )
}
