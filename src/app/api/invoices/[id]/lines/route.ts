import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { description, quantity, unit_price, discount, tva_rate, position } = body

    const { db } = await createCompanyClient()
    const { data, error } = await db.from("invoice_lines").insert([{
      invoice_id: id,
      description: description ?? "",
      quantity: quantity ?? 1,
      unit_price: unit_price ?? 0,
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
