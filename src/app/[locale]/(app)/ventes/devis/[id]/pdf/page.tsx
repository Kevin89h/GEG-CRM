import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import { notFound } from "next/navigation"
import PrintPage from "./PrintPage"

// v2
export default async function DevisPdfPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()
  const publicSupa = await createClient()
  const schema = await getCompanySchema()
  const { data: company } = await publicSupa.from("companies").select("id").eq("schema_name", schema).single()
  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const { data: order, error: orderErr } = await db
    .from("sales_orders")
    .select("id, number, currency, valid_until, notes, created_at, account_id, salesperson_id")
    .eq("id", id)
    .single()

  if (orderErr) console.error("PDF devis error:", orderErr.message)
  if (!order) notFound()

  const [{ data: account }, { data: salesperson }, { data: rawLines }, { data: bankAccounts }] = await Promise.all([
    order.account_id ? db.from("accounts").select("id, name, country").eq("id", order.account_id).single() : Promise.resolve({ data: null }),
    order.salesperson_id ? db.from("employees").select("full_name").eq("id", order.salesperson_id).single() : Promise.resolve({ data: null }),
    db.from("sales_order_lines").select("id, description, quantity, unit_price, discount, position, product_id").eq("order_id", id).order("position"),
    db.from("treasury_accounts").select("institution, account_number, swift, iban, currency").eq("type", "bank").eq("is_active", true).order("name"),
  ])

  const productIds = (rawLines ?? []).map((l: Record<string, unknown>) => l.product_id as string).filter(Boolean)
  const { data: products } = productIds.length > 0
    ? await db.from("products").select("id, name, reference").in("id", productIds)
    : { data: [] }
  const productMap = Object.fromEntries((products ?? []).map((p: Record<string, unknown>) => [p.id, p]))

  const lines = ((rawLines ?? []) as Record<string, unknown>[]).map(l => ({
    id: String(l.id ?? ""),
    description: String(l.description ?? ""),
    quantity: Number(l.quantity) || 0,
    unit_price: Number(l.unit_price) || 0,
    discount: Number(l.discount) || 0,
    product: l.product_id ? (productMap[l.product_id as string] as { name: string; reference: string | null } | null) ?? null : null,
  }))

  return (
    <PrintPage
      number={order.number}
      status={(order as Record<string, unknown>).status as string ?? "draft"}
      currency={order.currency}
      createdAt={order.created_at}
      validUntil={order.valid_until ?? null}
      notes={order.notes ?? null}
      deliveryAddress={null}
      paymentTerms={(order as Record<string, unknown>).payment_terms as string ?? null}
      accountName={(account as Record<string, string> | null)?.name ?? "—"}
      accountCountry={(account as Record<string, string> | null)?.country ?? null}
      salespersonName={(salesperson as Record<string, string> | null)?.full_name ?? null}
      lines={lines}
      locale={locale}
      docType="devis"
      docSettings={docSettings ?? null}
      bankAccounts={bankAccounts ?? []}
    />
  )
}
