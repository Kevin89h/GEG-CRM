import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest)  {
  try {
    const body = await req.json()
    const db = createAdminClient().schema("geg_guinee")

    const ALLOWED_CURRENCIES = ["GNF", "USD", "EUR"]
    const normalizeCurrency = (c: string) => ALLOWED_CURRENCIES.includes(c) ? c : "GNF"

    const { data, error } = await db
      .from("products")
      .insert([{
        name: body.name,
        reference: body.reference ?? null,
        description: body.description ?? null,
        category_id: body.category_id ?? null,
        unit_id: body.unit_id ?? null,
        buy_price: body.buy_price ?? null,
        buy_price_currency: normalizeCurrency(body.buy_price_currency ?? "GNF"),
        sell_price: body.sell_price ?? null,
        currency: normalizeCurrency(body.currency ?? "GNF"),
      }])
      .select("*, category:product_categories(id, name, color), unit:units(id, name, type)")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
