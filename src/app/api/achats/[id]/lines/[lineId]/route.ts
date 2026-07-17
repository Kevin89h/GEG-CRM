import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

type Params = { params: Promise<{ id: string; lineId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, lineId } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("purchase_order_lines")
    .update({
      description: body.description,
      quantity: body.quantity,
      fob_unit_price: body.fob_unit_price,
      product_id: body.product_id ?? null,
    })
    .eq("id", lineId)
    .eq("order_id", id)
    .select("id, product_id, description, quantity, fob_unit_price, position")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, lineId } = await params
  const { db } = await createCompanyClient()

  const { error } = await db
    .from("purchase_order_lines")
    .delete()
    .eq("id", lineId)
    .eq("order_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
