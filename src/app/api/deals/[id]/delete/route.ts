import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()

  const { error } = await db.from("deals").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
