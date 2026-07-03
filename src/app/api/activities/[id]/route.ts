import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// PATCH: update activity (toggle completed, update fields)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("activities")
    .update(body)
    .eq("id", id)
    .select("id, completed, subject, type")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE: remove an activity
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()

  const { error } = await db.from("activities").delete().eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
