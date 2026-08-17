import { createSchemaClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? ""
  const db = createSchemaClient(getSchemaFromRequest(req))

  let query = db.from("supplier_invoices")
    .select("id, number, supplier_name, total_ttc, currency, status, invoice_date")
    .is("deal_id", null)
    .order("invoice_date", { ascending: false })
    .limit(20)

  if (q.length >= 2) {
    query = query.or(`number.ilike.%${q}%,supplier_name.ilike.%${q}%`)
  }

  const { data } = await query
  return NextResponse.json(data ?? [])
}
