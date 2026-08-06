import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const schema = await getCompanySchema()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = (createAdminClient() as any).schema(schema)

    const patch: Record<string, unknown> = {}
    const allowed = ["name", "type", "industry", "country", "city", "address", "phone", "email", "website", "notes", "salesperson_id", "nif"]
    for (const k of allowed) {
      if (k in body) patch[k] = body[k]
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const { data, error } = await admin
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
    const schema = await getCompanySchema()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = (createAdminClient() as any).schema(schema)
    const { error } = await admin.from("accounts").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
