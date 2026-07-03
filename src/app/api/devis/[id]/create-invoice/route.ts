import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

interface OrderLine {
  description: string
  quantity: number
  unit_price: number
  discount: number
  product_id?: string | null
  tva_exempt?: boolean | null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { account_id, currency, tva, lines, user_id } = body as {
    account_id: string | null
    currency: string
    tva: boolean
    lines: OrderLine[]
    user_id: string
  }

  const { db } = await createCompanyClient()

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const { count } = await db.from("invoices").select("*", { count: "exact", head: true })
  const seq = String((count ?? 0) + 1).padStart(4, "0")
  const number = `FAC-${year}-${month}-${seq}`

  const today = now.toISOString().split("T")[0]
  const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const { data: invoice, error: invErr } = await db.from("invoices").insert([{
    number,
    order_id: id,
    account_id,
    currency,
    status: "draft",
    issue_date: today,
    due_date: due,
    user_id,
  }]).select("id").single()

  if (invErr || !invoice) {
    return NextResponse.json({ error: invErr?.message ?? "Erreur création facture" }, { status: 400 })
  }

  if (lines.length > 0) {
    const lineRows = lines.map((l, i) => ({
      invoice_id: invoice.id,
      product_id: l.product_id ?? null,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount: l.discount,
      position: i,
      tva_rate: tva && !l.tva_exempt ? 18 : 0,
    }))
    const { error: lineErr } = await db.from("invoice_lines").insert(lineRows)
    if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 400 })
  }

  const { error: orderErr } = await db.from("sales_orders").update({ status: "invoiced" }).eq("id", id)
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 400 })

  return NextResponse.json({ invoiceId: invoice.id })
}
