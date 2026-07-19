import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { createAdminClient } from "@/lib/supabase/admin"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { schema } = await createCompanyClient()

  if (schema === "geg_singapore") {
    const admin = createAdminClient()
    const { error } = await admin.rpc("delete_singapore_deal", { p_id: id })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  const { db } = await createCompanyClient()
  const { error } = await db.from("deals").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
