import { createCompanyClient } from "@/lib/company"
import InventaireClient from "./InventaireClient"

export default async function InventairePage() {
  const { db } = await createCompanyClient()

  const [{ data: products }, { data: warehouses }, { data: levels }] = await Promise.all([
    db.from("products").select("id, name, reference, is_active, unit:units(name), product_type").neq("product_type", "service").order("name"),
    db.from("warehouses").select("id, name").eq("is_active", true).order("name"),
    db.from("stock_levels").select("product_id, warehouse_id, quantity"),
  ])

  // A deactivated product stays visible here while it still holds stock, so that it can be counted (flagged)
  const held = new Set((levels ?? []).filter(l => Number(l.quantity) !== 0).map(l => l.product_id))
  const visible = (products ?? []).filter((p: Record<string, unknown>) => p.is_active || held.has(p.id as string))

  return (
    <InventaireClient
      products={visible.map((p: Record<string, unknown>) => ({ id: p.id as string, name: p.name as string, is_active: !!p.is_active, reference: (p.reference as string | null) ?? null, unit: Array.isArray(p.unit) ? (p.unit[0] as { name: string } | null) ?? null : (p.unit as { name: string } | null) }))}
      warehouses={(warehouses ?? []) as { id: string; name: string }[]}
      levels={(levels ?? []) as { product_id: string; warehouse_id: string; quantity: number }[]}
    />
  )
}
