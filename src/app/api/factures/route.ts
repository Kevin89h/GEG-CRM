import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

interface InvoiceLine {
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  discount: number
  position: number
  tva_rate: number
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { invoice: invoiceData, lines, user_id } = body as {
    invoice: Record<string, unknown>
    lines: InvoiceLine[]
    user_id: string
  }

  const { db } = await createCompanyClient()

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const { count } = await db.from("invoices").select("*", { count: "exact", head: true })
  const seq = String((count ?? 0) + 1).padStart(4, "0")
  const number = `FAC-${year}-${month}-${seq}`

  const { data: invoice, error: invErr } = await db.from("invoices").insert([{
    ...invoiceData,
    number,
    user_id,
  }]).select("id").single()

  if (invErr || !invoice) return NextResponse.json({ error: invErr?.message ?? "Erreur création facture" }, { status: 400 })

  if (lines.length > 0) {
    const { error: lineErr } = await db.from("invoice_lines").insert(
      lines.map(l => ({ ...l, invoice_id: invoice.id }))
    )
    if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 400 })
  }

  return NextResponse.json({ id: invoice.id })
}
