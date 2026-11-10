import { createSchemaClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import ProductDetailClient from "./ProductDetailClient"
import { hasPermission } from "@/lib/access"
import { getCompanyName, getCompanySchema } from "@/lib/company"

type Props = Parameters<typeof ProductDetailClient>[0]

// Product fiche of the ACTIVE company: an id from the other company is "not found".
// Stock (levels, moves, warehouses) is read for GEG Guinée only: GEG Singapour has no stock in use.
export default async function ProductDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const schema = await getCompanySchema()
  const stockEnabled = schema === "geg_guinee"
  const db = createSchemaClient(schema)

  // Edit, delete and internal references: "produits.gerer" / "produits.prix_achat" (D4)
  const [isAdmin, seeBuyPrice] = await Promise.all([hasPermission("produits.gerer"), hasPermission("produits.prix_achat")])

  const none = Promise.resolve({ data: [] as unknown[] })
  const [
    { data: product },
    { data: stockLevels },
    { data: moves },
    { data: categories },
    { data: units },
    { data: warehouses },
    { data: documents },
    companyName,
  ] = await Promise.all([
    db.from("products")
      .select("*, category:product_categories(id, name, color), unit:units(id, name, type)")
      .eq("id", id)
      .maybeSingle(),
    stockEnabled
      ? db.from("stock_levels")
        .select("quantity, warehouse:warehouses(id, name)")
        .eq("product_id", id)
      : none,
    stockEnabled
      ? db.from("stock_moves")
        .select("id, type, quantity, date, reference, from_warehouse_id, to_warehouse_id")
        .eq("product_id", id)
        .order("date", { ascending: false })
        .limit(50)
      : none,
    db.from("product_categories").select("id, name, color").order("name"),
    db.from("units").select("id, name, type").order("name"),
    stockEnabled ? db.from("warehouses").select("id, name").eq("is_active", true) : none,
    db.from("product_documents")
      .select("id, type, name, url, file_size, created_at")
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
    getCompanyName(schema),
  ])

  if (!product) notFound()

  const levels = (stockLevels ?? []) as unknown as Props["stockLevels"]
  const moveRows = (moves ?? []) as unknown as Props["moves"]
  const totalStock = levels.reduce((s, l) => s + Number(l.quantity), 0)
  const incoming = moveRows.filter(m => m.type === "in").reduce((s, m) => s + Number(m.quantity), 0)
  const outgoing = moveRows.filter(m => m.type === "out").reduce((s, m) => s + Number(m.quantity), 0)
  // GEG Singapour has no product code: always provide the field
  const row = { ...product, product_code: product.product_code ?? null }

  return (
    <ProductDetailClient
      product={(seeBuyPrice ? row : { ...row, buy_price: null, buy_price_currency: null, sku: null, internal_notes: null }) as Props["product"]}
      stockLevels={levels}
      moves={moveRows}
      documents={(documents ?? []) as Props["documents"]}
      totalStock={totalStock}
      incoming={incoming}
      outgoing={outgoing}
      categories={categories ?? []}
      units={units ?? []}
      warehouses={(warehouses ?? []) as Props["warehouses"]}
      locale={locale}
      isAdmin={isAdmin}
      companyName={companyName}
      stockEnabled={stockEnabled}
    />
  )
}
