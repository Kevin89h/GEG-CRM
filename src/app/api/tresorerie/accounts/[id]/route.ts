import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// PATCH: update a treasury account
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("treasury_accounts")
    .update(body)
    .eq("id", id)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE: remove a treasury account
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()

  const { error } = await db
    .from("treasury_accounts")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
