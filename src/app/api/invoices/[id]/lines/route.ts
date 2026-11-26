import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { description, quantity, unit_price, discount, tva_rate, position } = body

    const { db } = await createCompanyClient()
    // R1: a new line is created already linked to its catalogue sheet (designation and price of the sheet by default)
    let product: Record<string, unknown> | null = null
    if (typeof body.product_id === "string" && body.product_id) {
      const { data: p } = await db.from("products").select("*").eq("id", body.product_id).maybeSingle()
      if (!p) return NextResponse.json({ error: "Fiche introuvable" }, { status: 400 })
      product = p as Record<string, unknown>
    }
    const { data, error } = await db.from("invoice_lines").insert([{
      invoice_id: id,
      ...(product ? { product_id: product.id } : {}),
      description: description ?? (product?.name as string | undefined) ?? "",
      quantity: quantity ?? 1,
      unit_price: unit_price ?? (product ? Number(product.sell_price ?? product.sale_price ?? 0) : 0),
      discount: discount ?? 0,
      tva_rate: tva_rate ?? 0,
      position: position ?? 0,
    }]).select("id, product_id, description, quantity, unit_price, discount, tva_rate").single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ line: data })
  } catch (err) {
    console.error("Invoice line create error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
