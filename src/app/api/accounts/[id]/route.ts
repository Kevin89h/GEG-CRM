import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createCompanyClient } from "@/lib/company"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { schema } = await createCompanyClient()
  const db = createAdminClient().schema(schema)

  // Only update known-safe columns; omit address if the column doesn't exist yet
  const SAFE_FIELDS = ["name", "type", "industry", "country", "city", "phone", "email", "website", "notes", "salesperson_id"]
  const patch: Record<string, unknown> = {}
  for (const k of SAFE_FIELDS) {
    if (k in body) patch[k] = body[k]
  }

  // Try to include address; gracefully skip if column doesn't exist
  if ("address" in body) {
    const { error: colErr } = await db.from("accounts").update({ address: body.address }).eq("id", id)
    if (!colErr || !colErr.message.includes("address")) {
      // Column exists — include it in the main patch
      patch.address = body.address
    }
    // If error mentions "address", column doesn't exist yet — silently skip
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

  const { data, error } = await db
    .from("accounts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { schema } = await createCompanyClient()
  const db = createAdminClient().schema(schema)

  const { error } = await db.from("accounts").delete().eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
