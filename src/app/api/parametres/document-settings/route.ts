import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// POST: upsert document settings
// Send { id?, ...fields } — if id is present it's an update, otherwise insert
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db } = await createCompanyClient()

  if (body.id) {
    const { id, ...fields } = body
    const { data, error } = await db
      .from("document_settings")
      .update(fields)
      .eq("id", id)
      .select("id")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  const { data, error } = await db
    .from("document_settings")
    .insert([body])
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
