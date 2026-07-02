import { createCompanyClient } from "@/lib/company"
import NouveauMouvementClient from "./NouveauMouvementClient"
import type { Warehouse } from "@/types"

interface ProductOption {
  id: string
  name: string
  reference: string | null
  unit: { name: string } | null
}

interface StockLevel {
  product_id: string
  warehouse_id: string
  quantity: number
}

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ type?: string }>
}

export default async function NouveauMouvementPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { type } = await searchParams

  const { db: supabase } = await createCompanyClient()
  const [{ data: warehouses }, { data: products }, { data: stockLevels }] = await Promise.all([
    supabase.from("warehouses").select("*").eq("is_active", true).order("name"),
    supabase.from("products").select("id, name, reference, product_type, unit:units(name)").eq("is_active", true).order("name"),
    supabase.from("stock_levels").select("product_id, warehouse_id, quantity"),
  ])

  const typedProducts: ProductOption[] = (products ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    name: p.name as string,
    reference: (p.reference as string | null) ?? null,
    unit: Array.isArray(p.unit) ? (p.unit[0] as { name: string } | null) ?? null : (p.unit as { name: string } | null),
  }))

  return (
    <NouveauMouvementClient
      warehouses={(warehouses ?? []) as Warehouse[]}
      products={typedProducts}
      stockLevels={(stockLevels ?? []) as StockLevel[]}
      initialType={type}
      locale={locale}
    />
  )
}
