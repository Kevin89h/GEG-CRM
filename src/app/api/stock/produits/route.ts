import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("products")
    .insert([{
      name: body.name,
      reference: body.reference ?? null,
      description: body.description ?? null,
      category_id: body.category_id ?? null,
      unit_id: body.unit_id ?? null,
      buy_price: body.buy_price ?? null,
      buy_price_currency: body.buy_price_currency ?? "GNF",
      sell_price: body.sell_price ?? null,
      currency: body.currency ?? "GNF",
    }])
    .select("*, category:product_categories(id, name, color), unit:units(id, name, type)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
