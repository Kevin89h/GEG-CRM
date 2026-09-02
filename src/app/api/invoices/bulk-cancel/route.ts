import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest) {
  try {
    const { invoice_ids } = await req.json() as { invoice_ids: string[] }
    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0)
      return NextResponse.json({ error: "Aucune facture sélectionnée" }, { status: 400 })

    const { db } = await createCompanyClient()
    const { error } = await db
      .from("invoices")
      .update({ status: "cancelled" })
      .in("id", invoice_ids)
      .neq("status", "paid") // ne pas annuler une facture déjà payée

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, count: invoice_ids.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
