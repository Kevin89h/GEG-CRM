import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? ""
  const { db } = await createCompanyClient()

  let query = db
    .from("invoices")
    .select("id, number, status, total_ht, currency")
    .order("created_at", { ascending: false })
    .limit(30)

  if (q) query = query.ilike("number", `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}
