import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createCompanyClient } from "@/lib/company"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { schema } = await createCompanyClient()
    const db = createAdminClient().schema(schema)

    const patch: Record<string, unknown> = {}
    const allowed = ["name", "type", "industry", "country", "city", "address", "phone", "email", "website", "notes", "salesperson_id"]
    for (const k of allowed) {
      if (k in body) patch[k] = body[k]
    }

    const { data, error } = await db
      .from("accounts")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { schema } = await createCompanyClient()
    const db = createAdminClient().schema(schema)

    const { error } = await db.from("accounts").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
