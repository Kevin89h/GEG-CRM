import { NextRequest, NextResponse } from "next/server"
import { getSchemaFromRequest } from "@/lib/company"
import { createSchemaClient } from "@/lib/supabase/admin"
import { hasPermission } from "@/lib/access"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const schema = await getSchemaFromRequest(req)
  const db = createSchemaClient(schema)

  const ALLOWED_FIELDS = [
    "name", "reference", "merchant_reference", "description", "category_id", "unit_id",
    "product_type", "can_be_sold", "can_be_purchased",
    "sell_price", "currency", "buy_price", "buy_price_currency",
    "tva_vente", "tva_achat", "barcode", "sku", "origin", "internal_notes", "is_active",
  ]
  const update: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) update[key] = body[key]
  }

  // Purchase price and internal references need "produits.prix_achat" (D4); never returned without it
  const seeBuy = await hasPermission("produits.prix_achat")
  if (!seeBuy && ["buy_price", "buy_price_currency", "sku", "internal_notes"].some(k => k in update)) {
    return NextResponse.json({ error: "Vos permissions ne permettent pas de modifier le prix d'achat, le SKU ou les notes internes" }, { status: 403 })
  }

  const { data, error } = await db
    .from("products")
    .update(update)
    .eq("id", id)
    .select("*, category:product_categories(id, name, color), unit:units(id, name, type)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(seeBuy ? data : { ...data, buy_price: null, sku: null, internal_notes: null })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const schema = await getSchemaFromRequest(_req)
  const db = createSchemaClient(schema)

  const { error } = await db.from("products").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
