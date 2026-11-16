import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse, requirePermission } from "@/lib/access"

// A1: invoice search (deal page). Amounts come from the totals view (computed from the lines),
// never from a stored total column (absent in Guinée, always 0 in Singapour).
export async function GET(req: NextRequest)  {
  try {
    await requirePermission("factures.voir")
    const q = req.nextUrl.searchParams.get("q") ?? ""
    const { db } = await createCompanyClient()

    let query = db
      .from("invoice_totals")
      .select("id, number, status, total_ht, currency, issue_date")
      .order("issue_date", { ascending: false, nullsFirst: false })
      .limit(30)

    if (q) query = query.ilike("number", `%${q}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data ?? [])

  } catch (err) {
    return errorResponse(err)
  }
}
