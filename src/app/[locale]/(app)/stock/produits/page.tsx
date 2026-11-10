import { createSchemaClient } from "@/lib/supabase/admin"
import { hasPermission } from "@/lib/access"
import { getCompanyName, getCompanySchema } from "@/lib/company"
import ProduitsClient from "./ProduitsClient"

// Columns common to both companies; GEG Guinée also has the product code, the unit list and the packaging table
const COMMON_COLUMNS = "id, reference, name, description, buy_price, buy_price_currency, sell_price, currency, is_active, brand, to_complete, missing_info, category:product_categories(id, name, color), unit:units(id, name, type)"
const GUINEE_COLUMNS = `${COMMON_COLUMNS}, product_code, unit_ids, packaging:product_packaging(id, unit_id, sell_price, buy_price, currency, buy_price_currency)`

// Catalogue of the ACTIVE company (cookie checked against the user's companies, see getCompanySchema)
export default async function ProduitsPage() {
  const schema = await getCompanySchema()
  const isGuinee = schema === "geg_guinee"
  const supabase = createSchemaClient(schema)

  const loadProducts = async () => {
    const first = await supabase.from("products").select(isGuinee ? GUINEE_COLUMNS : COMMON_COLUMNS).order("name")
    if (!first.error || !isGuinee) return first
    // Guinée-only columns missing: fall back to the common ones
    return supabase.from("products").select(COMMON_COLUMNS).order("name")
  }

  const [{ data: products }, { data: categories }, { data: units }, companyName] = await Promise.all([
    loadProducts(),
    supabase.from("product_categories").select("*").order("name"),
    supabase.from("units").select("*").order("name"),
    getCompanyName(schema),
  ])

  // Creation and editing: "produits.gerer"; purchase prices: "produits.prix_achat" (D4, Q6)
  const [canWrite, seeBuyPrice] = await Promise.all([hasPermission("produits.gerer"), hasPermission("produits.prix_achat")])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((products ?? []) as any[]).map(p => ({
    ...p,
    product_code: p.product_code ?? null,
    unit_ids: p.unit_ids ?? null,
    packaging: p.packaging ?? null,
  }))
  const visible = seeBuyPrice ? rows : rows.map(p => ({
    ...p,
    buy_price: null,
    packaging: (p.packaging ?? []).map((k: Record<string, unknown>) => ({ ...k, buy_price: null })),
  }))
  return (
    <ProduitsClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products={visible as any}
      categories={categories ?? []}
      units={units ?? []}
      canWrite={canWrite}
      companyName={companyName}
      stockEnabled={isGuinee}
    />
  )
}
