import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { guard, requireSchemaAccess } from "@/lib/access"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard(() => requireSchemaAccess("geg_singapore"))
  if (denied) return denied
  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.rpc("delete_singapore_deal", { p_id: id })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// Transfer Singapore → Guinée: the user needs both companies
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard(async () => {
    await requireSchemaAccess("geg_singapore")
    await requireSchemaAccess("geg_guinee")
  })
  if (denied) return denied
  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("transfer_singapore_to_guinee", { p_deal_id: id })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, target: "geg_guinee", ...data })
}
