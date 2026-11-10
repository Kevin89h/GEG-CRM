import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { lockedInvoiceResponse } from "@/lib/invoice-lock"

// PATCH: set tva_rate on all lines of an invoice
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tva_rate } = await req.json() as { tva_rate: number }
  const { db } = await createCompanyClient()
  const locked = await lockedInvoiceResponse(db, id)
  if (locked) return locked

  const { error } = await db
    .from("invoice_lines")
    .update({ tva_rate })
    .eq("invoice_id", id)
    // Comment lines never carry VAT (the database refuses a rate on them)
    .neq("line_type", "comment")

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
