import { createCompanyClient } from "@/lib/company"
import NouveauMouvementClient from "./NouveauMouvementClient"
import type { Warehouse } from "@/types"

interface ProductOption {
  id: string
  name: string
  reference: string | null
  unit: { name: string } | null
}

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ type?: string }>
}

export default async function NouveauMouvementPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { type } = await searchParams

  const { db: supabase } = await createCompanyClient()
  const [{ data: warehouses }, { data: products }] = await Promise.all([
    supabase.from("warehouses").select("*").eq("is_active", true).order("name"),
    supabase.from("products").select("id, name, reference, unit:units(name)").eq("is_active", true).order("name"),
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
      initialType={type}
      locale={locale}
    />
  )
}
