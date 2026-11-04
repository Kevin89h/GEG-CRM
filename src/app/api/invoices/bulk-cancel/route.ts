import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse } from "@/lib/access"

// Only DRAFT invoices can be voided (Q2); emitted invoices are corrected by a credit note.
export async function POST(req: NextRequest) {
  try {
    const { invoice_ids } = await req.json() as { invoice_ids: string[] }
    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0)
      return NextResponse.json({ error: "Aucune facture sélectionnée" }, { status: 400 })

    const { db } = await createCompanyClient()
    const { data: rows } = await db.from("invoices").select("id, number, status").in("id", invoice_ids)
    const drafts = (rows ?? []).filter(r => r.status === "draft")
    const skipped = (rows ?? []).filter(r => r.status !== "draft").map(r => r.number)

    if (drafts.length) {
      const { error } = await db.from("invoices").update({ status: "cancelled" }).in("id", drafts.map(d => d.id)).eq("status", "draft")
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ success: true, count: drafts.length, skipped })
  } catch (err) {
    return errorResponse(err)
  }
}
