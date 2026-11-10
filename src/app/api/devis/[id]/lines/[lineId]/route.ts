import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// PATCH: update a line
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { id, lineId } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()
    { const { data: so } = await db.from("sales_orders").select("status").eq("id", id).single()
      if (so?.status === "invoiced" || so?.status === "cancelled") return NextResponse.json({ error: so.status === "cancelled" ? "Devis annulé : ses lignes ne sont plus modifiables" : "Devis facturé : ses lignes ne sont plus modifiables" }, { status: 409 }) }

  const { data, error } = await db
    .from("sales_order_lines")
    .update(body)
    .eq("id", lineId)
    .select("id, description, quantity, unit_price, discount, position, product_id, tva_exempt, line_type, print_on_pdf, print_on_delivery")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE: remove a line
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { id, lineId } = await params
  const { db } = await createCompanyClient()
    { const { data: so } = await db.from("sales_orders").select("status").eq("id", id).single()
      if (so?.status === "invoiced" || so?.status === "cancelled") return NextResponse.json({ error: so.status === "cancelled" ? "Devis annulé : ses lignes ne sont plus modifiables" : "Devis facturé : ses lignes ne sont plus modifiables" }, { status: 409 }) }

  const { error } = await db.from("sales_order_lines").delete().eq("id", lineId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
