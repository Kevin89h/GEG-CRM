import { createCompanyClient } from "@/lib/company"
import ProduitsClient from "./ProduitsClient"

export default async function ProduitsPage() {
  const { db: supabase } = await createCompanyClient()

  const [{ data: products }, { data: categories }, { data: units }] = await Promise.all([
    supabase
      .from("products")
      .select("id, reference, name, description, buy_price, buy_price_currency, sell_price, currency, is_active, category:product_categories(id, name, color), unit:units(id, name, type)")
      .order("name"),
    supabase.from("product_categories").select("*").order("name"),
    supabase.from("units").select("*").order("name"),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ProduitsClient products={(products ?? []) as any} categories={categories ?? []} units={units ?? []} />
}
