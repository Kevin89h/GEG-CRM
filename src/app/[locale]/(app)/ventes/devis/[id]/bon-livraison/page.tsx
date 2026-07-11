import { createCompanyClient } from "@/lib/company"
import { notFound } from "next/navigation"
import PrintPage from "../pdf/PrintPage"

export default async function BonLivraisonPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()

  const { data: order } = await db.from("sales_orders").select(`
      id, number, status, currency, valid_until, notes, created_at,
      account:accounts(id, name, country),
      salesperson:employees(full_name),
      lines:sales_order_lines(id, description, quantity, unit_price, discount, position, product_id, product:products(name, reference))
    `).eq("id", id).single()

  if (!order) notFound()

  // Idempotent stock deduction — only runs once per order
  const blNote = `BL-devis#${id}`
  const { data: existing } = await db.from("stock_moves").select("id").eq("notes", blNote).limit(1)
  if (!existing || existing.length === 0) {
    const productLines = ((order.lines ?? []) as Record<string, unknown>[]).filter(l => l.product_id)
    if (productLines.length > 0) {
      const { data: warehouse } = await db.from("warehouses").select("id").eq("is_active", true).order("name").limit(1).maybeSingle()
      const warehouseId = (warehouse as { id: string } | null)?.id ?? null
      if (warehouseId) {
        await db.from("stock_moves").insert(
          productLines.map(l => ({
            type: "out",
            product_id: String(l.product_id),
            from_warehouse_id: warehouseId,
            quantity: Number(l.quantity) || 0,
            notes: blNote,
          }))
        )
        for (const l of productLines) {
          const { data: level } = await db.from("stock_levels")
            .select("quantity")
            .eq("product_id", String(l.product_id))
            .eq("warehouse_id", warehouseId)
            .maybeSingle()
          const current = Number((level as { quantity: number } | null)?.quantity ?? 0)
          await db.from("stock_levels").upsert(
            { product_id: String(l.product_id), warehouse_id: warehouseId, quantity: Math.max(0, current - (Number(l.quantity) || 0)) },
            { onConflict: "product_id,warehouse_id" }
          )
        }
      }
    }
  }

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
      id={id}
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
      locale={locale}
      docType="bon-livraison"
    />
  )
}
