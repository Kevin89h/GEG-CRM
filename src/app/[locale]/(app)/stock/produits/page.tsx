import { createAdminClient } from "@/lib/supabase/admin"
import { hasPermission, requireSchemaPage } from "@/lib/access"
import ProduitsClient from "./ProduitsClient"

export default async function ProduitsPage() {
  await requireSchemaPage("geg_guinee")
  const supabase = createAdminClient().schema("geg_guinee")

  const [{ data: products }, { data: categories }, { data: units }] = await Promise.all([
    supabase
      .from("products")
      .select("id, product_code, reference, name, description, buy_price, buy_price_currency, sell_price, currency, is_active, unit_ids, brand, to_complete, missing_info, category:product_categories(id, name, color), unit:units(id, name, type), packaging:product_packaging(id, unit_id, sell_price, buy_price, currency, buy_price_currency)")
      .order("name"),
    supabase.from("product_categories").select("*").order("name"),
    supabase.from("units").select("*").order("name"),
  ])

  // Creation and editing: "produits.gerer"; purchase prices: "produits.prix_achat" (D4, Q6)
  const [canWrite, seeBuyPrice] = await Promise.all([hasPermission("produits.gerer"), hasPermission("produits.prix_achat")])
  const visible = seeBuyPrice ? products ?? [] : (products ?? []).map(p => ({
    ...p,
    buy_price: null,
    packaging: (p.packaging ?? []).map((k: Record<string, unknown>) => ({ ...k, buy_price: null })),
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ProduitsClient products={visible as any} categories={categories ?? []} units={units ?? []} canWrite={canWrite} />
}
