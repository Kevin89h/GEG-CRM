import { createCompanyClient } from "@/lib/company"
import { notFound } from "next/navigation"
import PrintPage from "../pdf/PrintPage"

export default async function BonLivraisonPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()

  const [{ data: order }, { data: bankAccounts }] = await Promise.all([
    db.from("sales_orders").select(`
      id, number, status, currency, valid_until, notes, created_at,
      account:accounts(id, name, country),
      salesperson:employees(full_name),
      lines:sales_order_lines(id, description, quantity, unit_price, discount, position, product:products(name, reference))
    `).eq("id", id).single(),
    db.from("treasury_accounts").select("name, institution, account_number, currency").eq("type", "bank").eq("is_active", true).order("currency").order("name"),
  ])

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
      validUntil={order.valid_until ?? null}
      notes={order.notes ?? null}
      accountName={(account as Record<string, string> | null)?.name ?? "—"}
      accountCountry={(account as Record<string, string> | null)?.country ?? null}
      salespersonName={(salesperson as Record<string, string> | null)?.full_name ?? null}
      lines={lines}
      bankAccounts={(bankAccounts ?? []).map(b => ({ name: b.name, institution: b.institution ?? "", account_number: b.account_number ?? "", currency: b.currency }))}
      locale={locale}
      docType="bon-livraison"
    />
  )
}
