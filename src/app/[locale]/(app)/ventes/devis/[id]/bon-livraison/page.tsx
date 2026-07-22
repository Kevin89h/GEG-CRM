import { createCompanyClient } from "@/lib/company"
import { notFound } from "next/navigation"
import BLPartielClient from "./BLPartielClient"

export default async function BonLivraisonPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()

  const { data: order } = await db
    .from("sales_orders")
    .select(`
      id, number,
      lines:sales_order_lines(id, description, quantity, qty_delivered, position, product_id, product:products(name, reference))
    `)
    .eq("id", id)
    .single()

  if (!order) notFound()

  const { data: warehousesRaw } = await db
    .from("warehouses")
    .select("id, name")
    .eq("is_active", true)
    .order("name")

  const lines = ((order.lines ?? []) as Record<string, unknown>[])
    .sort((a, b) => (a.position as number) - (b.position as number))
    .map(l => ({
      id: String(l.id ?? ""),
      description: String(l.description ?? ""),
      quantity: Number(l.quantity) || 0,
      qty_delivered: Number(l.qty_delivered) || 0,
      product_id: (l.product_id as string | null) ?? null,
      product: Array.isArray(l.product)
        ? (l.product[0] as { name: string; reference: string | null } | null) ?? null
        : (l.product as { name: string; reference: string | null } | null),
      position: Number(l.position) || 0,
    }))

  const warehouses = ((warehousesRaw ?? []) as { id: string; name: string }[]).map(w => ({
    id: w.id,
    name: w.name,
  }))

  return (
    <BLPartielClient
      orderId={id}
      orderNumber={order.number}
      locale={locale}
      lines={lines}
      warehouses={warehouses}
    />
  )
}
