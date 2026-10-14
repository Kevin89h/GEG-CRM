import { NextRequest, NextResponse } from "next/server"
import { createSchemaClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"

export async function GET(req: NextRequest) {
  const schema = getSchemaFromRequest(req)
  const db = createSchemaClient(schema)

  const { data: products, error } = await db
    .from("products")
    .select("id, name, reference, sell_price, currency, unit_ids, unit:units(id, name), packaging:product_packaging(unit_id, sell_price, currency)")
    .eq("is_active", true)
    .order("name")
    .limit(5)

  const { data: simple, error: simpleError } = await db
    .from("products")
    .select("id, name")
    .eq("is_active", true)
    .limit(5)

  return NextResponse.json({
    schema,
    fullQuery: { count: products?.length ?? 0, error: error?.message ?? null, sample: products?.[0] ?? null },
    simpleQuery: { count: simple?.length ?? 0, error: simpleError?.message ?? null },
  })
}
