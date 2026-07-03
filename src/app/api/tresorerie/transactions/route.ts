import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// POST: create one or more treasury transactions
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db } = await createCompanyClient()

  // body.rows is an array when a transfer creates two linked rows
  const rows: Record<string, unknown>[] = Array.isArray(body.rows) ? body.rows : [body]

  const { data, error } = await db
    .from("treasury_transactions")
    .insert(rows)
    .select("*")

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
