import { createCompanyClient } from "@/lib/company"
import InventaireClient from "./InventaireClient"

export default async function InventairePage() {
  const { db } = await createCompanyClient()

  const [{ data: products }, { data: warehouses }, { data: levels }] = await Promise.all([
    db.from("products").select("id, name, reference, unit:units(name), product_type").eq("is_active", true).neq("product_type", "service").order("name"),
    db.from("warehouses").select("id, name").eq("is_active", true).order("name"),
    db.from("stock_levels").select("product_id, warehouse_id, quantity"),
  ])

  return (
    <InventaireClient
      products={(products ?? []).map((p: Record<string, unknown>) => ({ id: p.id as string, name: p.name as string, reference: (p.reference as string | null) ?? null, unit: Array.isArray(p.unit) ? (p.unit[0] as { name: string } | null) ?? null : (p.unit as { name: string } | null) }))}
      warehouses={(warehouses ?? []) as { id: string; name: string }[]}
      levels={(levels ?? []) as { product_id: string; warehouse_id: string; quantity: number }[]}
    />
  )
}
