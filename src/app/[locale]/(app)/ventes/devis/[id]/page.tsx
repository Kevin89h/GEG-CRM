import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import { notFound } from "next/navigation"
import DevisDetailClient from "./DevisDetailClient"

export default async function DevisDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db: supabase } = await createCompanyClient()
  const publicSupa = await createClient()
  const schema = await getCompanySchema()
  const { data: company } = await publicSupa.from("companies").select("id").eq("schema_name", schema).single()
  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const { data: order } = await supabase
    .from("sales_orders")
    .select(`
      id, number, status, currency, valid_until, notes, created_at, payment_terms, client_order_ref, date_order, tva,
      account:accounts(id, name, country),
      contact:contacts(id, first_name, last_name),
      salesperson:employees(full_name),
      lines:sales_order_lines(id, description, quantity, unit_price, discount, position, product_id, product:products(name, reference))
    `)
    .eq("id", id)
    .single()

  if (!order) notFound()

  // Stock levels
  const productIds = (order.lines ?? [])
    .map((l: Record<string, unknown>) => l.product_id as string)
    .filter(Boolean)

  const stockByProduct: Record<string, number> = {}
  let firstWarehouse: { id: string; name: string } | null = null

  if (productIds.length > 0) {
    const { data: levels } = await supabase
      .from("stock_levels")
      .select("product_id, quantity")
      .in("product_id", productIds)
    for (const l of levels ?? []) {
      stockByProduct[l.product_id] = (stockByProduct[l.product_id] ?? 0) + l.quantity
    }
  }

  const { data: warehouseData } = await supabase
    .from("warehouses")
    .select("id, name")
    .eq("is_active", true)
    .limit(1)
    .single()
  if (warehouseData) firstWarehouse = warehouseData

  // Linked documents count
  const [{ count: invoiceCount, data: invoiceData }, { count: deliveryCount }] = await Promise.all([
    supabase.from("invoices").select("id", { count: "exact" }).eq("order_id", id),
    supabase.from("delivery_notes").select("id", { count: "exact" }).eq("order_id", id),
  ])
  const firstInvoiceId = invoiceData?.[0]?.id ?? null

  const typedOrder = {
    ...order,
    account: Array.isArray(order.account) ? order.account[0] ?? null : order.account,
    contact: Array.isArray(order.contact) ? order.contact[0] ?? null : order.contact,
    salesperson: Array.isArray(order.salesperson) ? order.salesperson[0] ?? null : (order.salesperson ?? null),
    lines: ((order.lines ?? []) as Record<string, unknown>[])
      .sort((a, b) => (a.position as number) - (b.position as number))
      .map(l => ({
        ...l,
        product: Array.isArray(l.product) ? l.product[0] ?? null : l.product,
        unit: Array.isArray(l.unit) ? l.unit[0] ?? null : (l.unit ?? null),
      })),
  }

  return <DevisDetailClient order={typedOrder as Parameters<typeof DevisDetailClient>[0]["order"]} locale={locale} docSettings={docSettings ?? {}} stockByProduct={stockByProduct} firstWarehouse={firstWarehouse} invoiceCount={invoiceCount ?? 0} firstInvoiceId={firstInvoiceId} deliveryCount={deliveryCount ?? 0} />
}
