import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()

  const { data: source, error: srcErr } = await db
    .from("sales_orders")
    .select("account_id, contact_id, currency, payment_terms, notes, tva, user_id")
    .eq("id", id)
    .single()

  if (srcErr || !source) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })

  const { data: sourceLines } = await db
    .from("sales_order_lines")
    .select("product_id, description, quantity, unit_price, discount, position, tva_exempt")
    .eq("order_id", id)
    .order("position")

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const { count } = await db.from("sales_orders").select("*", { count: "exact", head: true })
  const number = `DEV-${year}-${month}-${String((count ?? 0) + 1).padStart(4, "0")}`

  const { data: newOrder, error: orderErr } = await db
    .from("sales_orders")
    .insert([{
      account_id: source.account_id,
      contact_id: source.contact_id,
      currency: source.currency,
      payment_terms: source.payment_terms,
      notes: source.notes,
      tva: source.tva,
      user_id: source.user_id,
      status: "draft",
      number,
    }])
    .select("id")
    .single()

  if (orderErr || !newOrder) return NextResponse.json({ error: orderErr?.message }, { status: 400 })

  if (sourceLines && sourceLines.length > 0) {
    await db.from("sales_order_lines").insert(
      sourceLines.map(l => ({ ...l, order_id: newOrder.id }))
    )
  }

  return NextResponse.json({ id: newOrder.id })
}
