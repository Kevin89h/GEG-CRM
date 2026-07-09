import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST: upsert document settings (table is in public schema)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = await createClient()

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
