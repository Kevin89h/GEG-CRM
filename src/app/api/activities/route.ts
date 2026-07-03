import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// POST: create a new activity
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("activities")
    .insert([body])
    .select("*, account:accounts(id, name), deal:deals(id, title), contact:contacts(id, first_name, last_name)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
