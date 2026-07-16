import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { supabase, db } = await createCompanyClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await db
    .from("activities")
    .insert([{
      type: body.type ?? "note",
      subject: body.subject,
      notes: body.notes ?? null,
      date: body.date ?? new Date().toISOString(),
      follow_up_date: body.follow_up_date ?? null,
      completed: false,
      deal_id: id,
      account_id: body.account_id ?? null,
      contact_id: null,
      user_id: user.id,
    }])
    .select("id, type, subject, notes, date, follow_up_date, completed, user_id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
