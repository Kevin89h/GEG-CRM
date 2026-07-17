import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

type Params = { params: Promise<{ id: string; actId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { actId } = await params
  const body = await req.json()
  const { supabase, db } = await createCompanyClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await db
    .from("activities")
    .update({
      subject: body.subject,
      notes: body.notes ?? null,
      type: body.type,
    })
    .eq("id", actId)
    .eq("user_id", user.id)
    .select("id, type, subject, notes, date, follow_up_date, completed, user_id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, actId } = await params
  const { supabase, db } = await createCompanyClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await db
    .from("activities")
    .delete()
    .eq("id", actId)
    .eq("deal_id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
