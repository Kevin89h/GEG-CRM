import { createSchemaClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"
import { NextRequest, NextResponse } from "next/server"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; costId: string }> }
) {
  const { costId } = await params
  const db = createSchemaClient(getSchemaFromRequest(req))
  const { error } = await db.from("deal_costs").delete().eq("id", costId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; costId: string }> }
) {
  const { costId } = await params
  const body = await req.json()
  const db = createSchemaClient(getSchemaFromRequest(req))
  const { data, error } = await db.from("deal_costs")
    .update({ paid: body.paid })
    .eq("id", costId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
