import { createCompanyClient } from "@/lib/company"
import { notFound } from "next/navigation"
import ProductDetailClient from "./ProductDetailClient"

export default async function ProductDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()

  const [
    { data: product },
    { data: stockLevels },
    { data: moves },
    { data: categories },
    { data: units },
    { data: warehouses },
  ] = await Promise.all([
    db.from("products")
      .select("*, category:product_categories(id, name, color), unit:units(id, name, type)")
      .eq("id", id)
      .single(),
    db.from("stock_levels")
      .select("quantity, warehouse:warehouses(id, name)")
      .eq("product_id", id),
    db.from("stock_moves")
      .select("id, type, quantity, date, reference, from_warehouse_id, to_warehouse_id")
      .eq("product_id", id)
      .order("date", { ascending: false })
      .limit(50),
    db.from("product_categories").select("id, name, color").order("name"),
    db.from("units").select("id, name, type").order("name"),
    db.from("warehouses").select("id, name").eq("is_active", true),
  ])

  if (!product) notFound()

  const totalStock = (stockLevels ?? []).reduce((s, l) => s + Number(l.quantity), 0)
  const incoming = (moves ?? []).filter(m => m.type === "in").reduce((s, m) => s + Number(m.quantity), 0)
  const outgoing = (moves ?? []).filter(m => m.type === "out").reduce((s, m) => s + Number(m.quantity), 0)

  return (
    <ProductDetailClient
      product={product as Parameters<typeof ProductDetailClient>[0]["product"]}
      stockLevels={(stockLevels ?? []) as Parameters<typeof ProductDetailClient>[0]["stockLevels"]}
      moves={(moves ?? []) as Parameters<typeof ProductDetailClient>[0]["moves"]}
      totalStock={totalStock}
      incoming={incoming}
      outgoing={outgoing}
      categories={categories ?? []}
      units={units ?? []}
      warehouses={warehouses ?? []}
      locale={locale}
    />
  )
}
