import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// PATCH: update deal fields (stage, value, probability, etc.)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("deals")
    .update(body)
    .eq("id", id)
    .select("id, stage, value, probability, title")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
