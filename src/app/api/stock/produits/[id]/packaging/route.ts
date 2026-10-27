import { NextRequest, NextResponse } from "next/server"
import { getSchemaFromRequest } from "@/lib/company"
import { createSchemaClient } from "@/lib/supabase/admin"
import { errorResponse } from "@/lib/access"

const ALLOWED_CURRENCIES = ["GNF", "USD", "EUR"]
const normCur = (c: string) => ALLOWED_CURRENCIES.includes(c) ? c : "GNF"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: product_id } = await params
    const body = await req.json()
    const db = createSchemaClient(await getSchemaFromRequest(req))

    const rows = (body.packaging as Array<{
      unit_id: string; sell_price?: number | null; buy_price?: number | null
      currency?: string; buy_price_currency?: string
    }>)

    if (!Array.isArray(rows)) return NextResponse.json({ error: "packaging must be an array" }, { status: 400 })

    // Delete existing then reinsert (simpler than upsert with conflict resolution)
    await db.from("product_packaging").delete().eq("product_id", product_id)

    if (rows.length > 0) {
      const { error } = await db.from("product_packaging").insert(
        rows.map(r => ({
          product_id,
          unit_id: r.unit_id,
          sell_price: r.sell_price ?? null,
          buy_price: r.buy_price ?? null,
          currency: normCur(r.currency ?? "GNF"),
          buy_price_currency: normCur(r.buy_price_currency ?? "GNF"),
        }))
      )
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const { data } = await db
      .from("product_packaging")
      .select("id, unit_id, sell_price, buy_price, currency, buy_price_currency")
      .eq("product_id", product_id)

    return NextResponse.json(data ?? [])
  } catch (err) {
    return errorResponse(err)
  }
}
