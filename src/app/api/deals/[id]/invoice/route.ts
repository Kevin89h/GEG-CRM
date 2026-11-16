import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse, requirePermission } from "@/lib/access"

// PATCH /api/deals/[id]/invoice — body: { invoice_id: string | null }
// Sets invoices.deal_id = deal.id for the given invoice (or clears it).
// A1: the amount returned comes from the totals view, never from a stored total column.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("opportunites.modifier")
    await requirePermission("factures.voir")
    const { id } = await params
    const body = await req.json()
    const { db } = await createCompanyClient()
    const { invoice_id } = body as { invoice_id: string | null }

    // the deal and the invoice must both belong to the active company before anything changes
    const { data: deal } = await db.from("deals").select("id").eq("id", id).maybeSingle()
    if (!deal) return NextResponse.json({ error: "Opportunité introuvable dans cette société" }, { status: 404 })
    if (invoice_id) {
      const { data: inv } = await db.from("invoices").select("id").eq("id", invoice_id).maybeSingle()
      if (!inv) return NextResponse.json({ error: "Facture introuvable dans cette société" }, { status: 404 })
    }

    // Clear any existing link for this deal first
    const { error: clearError } = await db
      .from("invoices")
      .update({ deal_id: null })
      .eq("deal_id", id)
    if (clearError) return NextResponse.json({ error: clearError.message }, { status: 400 })

    if (!invoice_id) return NextResponse.json(null)

    // Link the new invoice (only the deal_id changes)
    const { error } = await db.from("invoices").update({ deal_id: id }).eq("id", invoice_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const { data, error: readError } = await db
      .from("invoice_totals")
      .select("id, number, status, total_ht, currency")
      .eq("id", invoice_id)
      .single()
    if (readError) return NextResponse.json({ error: readError.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    return errorResponse(err)
  }
}
