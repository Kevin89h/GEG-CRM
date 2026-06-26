import { createCompanyClient } from "@/lib/company"
import StockDashboard from "./StockDashboard"
import type { Warehouse } from "@/types"

type ProductRow = {
  id: string
  name: string
  reference: string | null
  category: { name: string; color: string } | null
  unit: { name: string } | null
}

type LevelRow = {
  id: string
  quantity: number
  product: { id: string; name: string; reference: string | null; category: { name: string; color: string } | null; unit: { name: string } | null }
  warehouse: { id: string; name: string; city: string | null }
}

function normalizeJoin<T>(val: T | T[] | null | undefined): T | null {
  if (Array.isArray(val)) return val[0] ?? null
  return val ?? null
}

export default async function StockPage() {
  const { db: supabase } = await createCompanyClient()

  const [{ data: levels }, { data: warehouses }, { data: products }] = await Promise.all([
    supabase
      .from("stock_levels")
      .select("*, product:products(id, name, reference, category:product_categories(name, color), unit:units(name)), warehouse:warehouses(id, name, city)")
      .order("updated_at", { ascending: false }),
    supabase.from("warehouses").select("*").eq("is_active", true).order("name"),
    supabase.from("products").select("id, name, reference, category:product_categories(name, color), unit:units(name)").eq("is_active", true).order("name"),
  ])

  const typedLevels: LevelRow[] = (levels ?? []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    quantity: l.quantity as number,
    product: (() => {
      const p = normalizeJoin(l.product as Record<string, unknown>) as Record<string, unknown> | null
      if (!p) return { id: "", name: "", reference: null, category: null, unit: null }
      return {
        id: p.id as string,
        name: p.name as string,
        reference: (p.reference as string | null) ?? null,
        category: normalizeJoin(p.category as { name: string; color: string } | { name: string; color: string }[] | null),
        unit: normalizeJoin(p.unit as { name: string } | { name: string }[] | null),
      }
    })(),
    warehouse: (() => {
      const w = normalizeJoin(l.warehouse as Record<string, unknown>) as Record<string, unknown> | null
      if (!w) return { id: "", name: "", city: null }
      return { id: w.id as string, name: w.name as string, city: (w.city as string | null) ?? null }
    })(),
  }))

  const typedProducts: ProductRow[] = (products ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    name: p.name as string,
    reference: (p.reference as string | null) ?? null,
    category: normalizeJoin(p.category as { name: string; color: string } | { name: string; color: string }[] | null),
    unit: normalizeJoin(p.unit as { name: string } | { name: string }[] | null),
  }))

  return (
    <StockDashboard
      levels={typedLevels}
      warehouses={(warehouses ?? []) as Warehouse[]}
      products={typedProducts}
    />
  )
}
