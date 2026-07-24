import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// PATCH /api/deals/[id]/invoice — body: { invoice_id: string | null }
// Sets invoices.deal_id = deal.id for the given invoice (or clears it)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()
  const { invoice_id } = body as { invoice_id: string | null }

  // Clear any existing link for this deal first
  const { error: clearError } = await db
    .from("invoices")
    .update({ deal_id: null })
    .eq("deal_id", id)

  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 400 })

  if (!invoice_id) return NextResponse.json(null)

  // Link the new invoice
  const { data, error } = await db
    .from("invoices")
    .update({ deal_id: id })
    .eq("id", invoice_id)
    .select("id, number, status, total_ht, currency")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
