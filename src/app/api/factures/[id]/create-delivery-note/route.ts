import { NextRequest, NextResponse } from "next/server"
import { nextDeliveryNoteNumber } from "@/lib/numbering"
import { createSchemaClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"
import { errorResponse, requireSchemaAccess } from "@/lib/access"
import { stockEngine } from "@/lib/stock-engine"
import { applyValidatedLinks } from "@/lib/delivery-lines"

// POST — « Livrer » an emitted invoice (permission "livraisons.creer", checked by the middleware). A1 (GEG 24/11/2026):
// - an existing DRAFT delivery note of this invoice is reused (never a second draft, even on a double click);
// - otherwise a draft is created with, for each goods line, what REMAINS to deliver (all confirmed notes deducted),
//   linked to its invoice line; services, discounts and quantities already delivered are left out; comments chosen
//   for the delivery note are kept as text;
// - nothing leaves the stock here: only the confirmation of the delivery note moves the stock.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const schema = await getCompanySchema()
    const access = await requireSchemaAccess(schema)
    const db = createSchemaClient(schema)
    const r = await stockEngine<{ id: string; number: string; reused: boolean }>(db, "livraison_preparer", {
      p_invoice: id, p_number: await nextDeliveryNoteNumber(db), p_user: access.userId,
    })
    if (!r.ok) return r.response
    // an old free line of the invoice gets its sheet from a VALIDATED historical correspondence (never a proposed one)
    if (!r.data.reused) await applyValidatedLinks(db, r.data.id, "invoice_lines", id)
    return NextResponse.json({ deliveryNoteId: r.data.id, number: r.data.number, reused: r.data.reused })
  } catch (err) {
    return errorResponse(err)
  }
}
