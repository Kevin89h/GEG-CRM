import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createSchemaClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const schema = getSchemaFromRequest(req)

  if (schema === "geg_singapore") {
    const admin = createAdminClient()
    const { error } = await admin.rpc("delete_singapore_deal", { p_id: id })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  const db = createSchemaClient(schema)
  const { error } = await db.from("deals").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
