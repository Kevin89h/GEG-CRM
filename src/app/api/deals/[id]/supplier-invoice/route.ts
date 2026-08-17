import { createSchemaClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"
import { NextRequest, NextResponse } from "next/server"

// PATCH: link or unlink a supplier invoice to this deal
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supplier_invoice_id, action } = await req.json()
  const db = createSchemaClient(getSchemaFromRequest(req))

  if (action === "unlink") {
    const { error } = await db.from("supplier_invoices")
      .update({ deal_id: null })
      .eq("id", supplier_invoice_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // link
  const { data, error } = await db.from("supplier_invoices")
    .update({ deal_id: id })
    .eq("id", supplier_invoice_id)
    .select("id, number, supplier_name, total_ttc, total_ht, currency, status, invoice_date")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
