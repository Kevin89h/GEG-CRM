import { createSchemaClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createSchemaClient(getSchemaFromRequest(req))

  const [
    { data: supplierInvoices },
    { data: dealCosts },
    { data: invoice },
  ] = await Promise.all([
    db.from("supplier_invoices")
      .select("id, number, supplier_name, total_ttc, total_ht, currency, status, invoice_date")
      .eq("deal_id", id)
      .order("invoice_date", { ascending: false }),
    db.from("deal_costs")
      .select("id, type, label, amount, currency, paid, created_at")
      .eq("deal_id", id)
      .order("created_at", { ascending: false }),
    db.from("invoice_totals")
      .select("id, number, status, total_ht, total_ttc, total_paid, currency")
      .eq("deal_id", id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    supplierInvoices: supplierInvoices ?? [],
    dealCosts: dealCosts ?? [],
    invoice: invoice ?? null,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { type, label, amount, currency, paid } = body

  if (!type || !amount || amount <= 0) {
    return NextResponse.json({ error: "Type et montant requis" }, { status: 400 })
  }

  const db = createSchemaClient(getSchemaFromRequest(req))
  const { data, error } = await db.from("deal_costs").insert({
    deal_id: id,
    type,
    label: label || null,
    amount: Number(amount),
    currency: currency || "GNF",
    paid: !!paid,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
