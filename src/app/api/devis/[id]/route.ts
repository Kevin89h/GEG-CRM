import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// PATCH: update order fields (status, payment_terms, valid_until, client_order_ref, tva, etc.)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db, schema } = await createCompanyClient()

  if (schema === "geg_singapore") {
    return NextResponse.json({ error: "Les devis ne sont pas disponibles pour le bureau de Singapour." }, { status: 400 })
  }

  const { data, error } = await db
    .from("sales_orders")
    .update(body)
    .eq("id", id)
    .select("id, status, payment_terms, valid_until, client_order_ref, tva")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
