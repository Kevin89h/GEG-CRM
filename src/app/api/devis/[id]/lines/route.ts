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

  // R1: a new line is created already linked to its catalogue sheet (designation and price of the sheet by default)
  let product: Record<string, unknown> | null = null
  if (typeof body.product_id === "string" && body.product_id) {
    const { data: p } = await db.from("products").select("*").eq("id", body.product_id).maybeSingle()
    if (!p) return NextResponse.json({ error: "Fiche introuvable" }, { status: 400 })
    product = p as Record<string, unknown>
  }

  const { data, error } = await db.from("sales_order_lines").insert([{
    order_id: id,
    ...(product ? { product_id: product.id } : {}),
    description: body.description ?? (product?.name as string | undefined) ?? "Nouvelle ligne",
    quantity: body.quantity ?? 1,
    unit_price: body.unit_price ?? (product ? Number(product.sell_price ?? product.sale_price ?? 0) : 0),
    discount: body.discount ?? 0,
    position: nextPosition,
  }]).select("id, description, quantity, unit_price, discount, position, product_id, tva_exempt").single()

  if (error) {
    console.error("devis line insert error:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json(data)
}
