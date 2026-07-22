import { createCompanyClient } from "@/lib/company"
import PertesClient from "./PertesClient"

interface Move {
  id: string
  type: string
  quantity: number
  notes: string | null
  created_at: string
  from_warehouse_id: string | null
  product: { name: string; reference: string | null } | null
  from_warehouse: { name: string } | null
}

export default async function PertesPage() {
  const { db } = await createCompanyClient()

  const { data: moves } = await db
    .from("stock_moves")
    .select("id, type, quantity, notes, created_at, from_warehouse_id, product:products(name, reference), from_warehouse:warehouses!from_warehouse_id(name)")
    .in("type", ["damaged", "lost", "destroyed"])
    .order("created_at", { ascending: false })

  return <PertesClient moves={(moves ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    type: m.type as string,
    quantity: m.quantity as number,
    notes: m.notes as string | null,
    created_at: m.created_at as string,
    from_warehouse_id: m.from_warehouse_id as string | null,
    product: m.product as { name: string; reference: string | null } | null,
    from_warehouse: m.from_warehouse as { name: string } | null,
  }))} />
}
