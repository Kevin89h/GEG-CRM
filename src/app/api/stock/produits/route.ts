import { NextRequest, NextResponse } from "next/server"
import { getSchemaFromRequest } from "@/lib/company"
import { createSchemaClient } from "@/lib/supabase/admin"
import { errorResponse } from "@/lib/access"

export async function POST(req: NextRequest)  {
  try {
    const body = await req.json()
    const schema = await getSchemaFromRequest(req)
    const db = createSchemaClient(schema)

    const ALLOWED_CURRENCIES = ["GNF", "USD", "EUR"]
    const normalizeCurrency = (c: string) => ALLOWED_CURRENCIES.includes(c) ? c : "GNF"

    // Generate next PRD-XXXXX code
    const { data: lastCode } = await db
      .from("products")
      .select("product_code")
      .like("product_code", "PRD-%")
      .order("product_code", { ascending: false })
      .limit(1)
      .single()

    const nextNum = lastCode?.product_code
      ? parseInt(lastCode.product_code.replace("PRD-", ""), 10) + 1
      : 1
    const product_code = `PRD-${String(nextNum).padStart(5, "0")}`

    const { data, error } = await db
      .from("products")
      .insert([{
        name: body.name,
        product_code,
        reference: body.reference ?? null,
        description: body.description ?? null,
        category_id: body.category_id ?? null,
        unit_id: (body.unit_ids as string[] | null)?.length ? body.unit_ids[0] : (body.unit_id ?? null),
        unit_ids: (body.unit_ids as string[] | null)?.length ? body.unit_ids : null,
        buy_price: body.buy_price ?? null,
        buy_price_currency: normalizeCurrency(body.buy_price_currency ?? "GNF"),
        sell_price: body.sell_price ?? null,
        currency: normalizeCurrency(body.currency ?? "GNF"),
      }])
      .select("*, category:product_categories(id, name, color), unit:units(id, name, type), unit_ids")
      .single()

    if (error) {
      const msg = error.message.includes("products_reference_key")
        ? "Une référence identique existe déjà. Laissez le champ vide ou choisissez une référence unique."
        : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json(data)

  } catch (err) {
    return errorResponse(err)
  }
}
