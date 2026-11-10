import { commentFields, invalidSalesLines } from "@/lib/catalog"
import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const { db } = await createCompanyClient()
    { const { data: so } = await db.from("sales_orders").select("status").eq("id", id).single()
      if (so?.status === "invoiced" || so?.status === "cancelled") return NextResponse.json({ error: so.status === "cancelled" ? "Devis annulé : ses lignes ne sont plus modifiables" : "Devis facturé : ses lignes ne sont plus modifiables" }, { status: 409 }) }

  // R1 / R2: a new line is created FROM an active catalogue product (designation and price taken from it),
  // or is a comment line (text only, no quantity nor amount)
  const invalid = await invalidSalesLines(db, [body])
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
  const comment = commentFields(body)
  const { data: product } = comment ? { data: null } : await db.from("products").select("name, sell_price").eq("id", body.product_id).single()

  const { data: existing } = await db
    .from("sales_order_lines")
    .select("position")
    .eq("order_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPosition = ((existing?.position as number) ?? 0) + 1

  const { data, error } = await db.from("sales_order_lines").insert([comment ? { ...comment, order_id: id, position: nextPosition } : {
    order_id: id,
    product_id: body.product_id,
    description: body.description ?? product?.name ?? "",
    quantity: body.quantity ?? 1,
    unit_price: body.unit_price ?? product?.sell_price ?? 0,
    discount: body.discount ?? 0,
    position: nextPosition,
  }]).select("id, description, quantity, unit_price, discount, position, product_id, tva_exempt, line_type, print_on_pdf, print_on_delivery").single()

  if (error) {
    console.error("devis line insert error:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json(data)
}
