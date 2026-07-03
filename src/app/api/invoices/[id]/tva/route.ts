import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// PATCH: set tva_rate on all lines of an invoice
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tva_rate } = await req.json() as { tva_rate: number }
  const { db } = await createCompanyClient()

  const { error } = await db
    .from("invoice_lines")
    .update({ tva_rate })
    .eq("invoice_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
