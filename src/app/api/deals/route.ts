import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// POST: create a new deal
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("deals")
    .insert([body])
    .select("*, account:accounts(id, name)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
