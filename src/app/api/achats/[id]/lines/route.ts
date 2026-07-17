import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("purchase_order_lines")
    .insert([{
      order_id: id,
      product_id: body.product_id ?? null,
      description: body.description,
      quantity: body.quantity,
      fob_unit_price: body.fob_unit_price,
      position: body.position ?? 0,
    }])
    .select("id, product_id, description, quantity, fob_unit_price, position")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
