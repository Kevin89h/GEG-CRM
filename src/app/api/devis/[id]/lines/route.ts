import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const { db } = await createCompanyClient()

  const { data: existing } = await db
    .from("sales_order_lines")
    .select("position")
    .eq("order_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPosition = ((existing?.position as number) ?? 0) + 1

  const { data, error } = await db.from("sales_order_lines").insert([{
    order_id: id,
    description: body.description ?? "Nouvelle ligne",
    quantity: body.quantity ?? 1,
    unit_price: body.unit_price ?? 0,
    discount: body.discount ?? 0,
    position: nextPosition,
  }]).select("id, description, quantity, unit_price, discount, position, product_id, tva_exempt").single()

  if (error) {
    console.error("devis line insert error:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json(data)
}
