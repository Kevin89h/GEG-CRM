import { invalidSalesLines } from "@/lib/catalog"
import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"
import { lockedInvoiceResponse } from "@/lib/invoice-lock"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { product_id, description, quantity, unit_price, discount, tva_rate, position } = body

    const { db } = await createCompanyClient()
    const locked = await lockedInvoiceResponse(db, id)
    if (locked) return locked
    // R1 / R2: a new line is created FROM an active catalogue product
    const invalid = await invalidSalesLines(db, [{ product_id, description }])
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    const { data: product } = await db.from("products").select("name, sell_price").eq("id", product_id).single()
    const { data, error } = await db.from("invoice_lines").insert([{
      invoice_id: id,
      product_id,
      description: description ?? product?.name ?? "",
      quantity: quantity ?? 1,
      unit_price: unit_price ?? product?.sell_price ?? 0,
      discount: discount ?? 0,
      tva_rate: tva_rate ?? 0,
      position: position ?? 0,
    }]).select("id, product_id, description, quantity, unit_price, discount, tva_rate").single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ line: data })
  } catch (err) {
    console.error("Invoice line create error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
