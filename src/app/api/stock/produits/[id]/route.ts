import { NextRequest, NextResponse } from "next/server"
import { getSchemaFromRequest } from "@/lib/company"
import { createSchemaClient } from "@/lib/supabase/admin"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const schema = getSchemaFromRequest(req)
  const db = createSchemaClient(schema)

  const ALLOWED_FIELDS = ["name", "sku", "description", "category_id", "unit_id", "selling_price",
    "purchase_price", "tva_rate", "is_active", "image_url", "barcode", "min_stock", "max_stock"]
  const update: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await db
    .from("products")
    .update(update)
    .eq("id", id)
    .select("*, category:product_categories(id, name, color), unit:units(id, name, type)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const schema = getSchemaFromRequest(_req)
  const db = createSchemaClient(schema)

  const { error } = await db.from("products").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
