import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()

  // Fetch original invoice + lines
  const { data: original, error: fetchErr } = await db
    .from("invoices")
    .select("account_id, currency, notes, lines:invoice_lines(description, product_id, quantity, unit_price, discount, tva_rate, position)")
    .eq("id", id)
    .single()

  if (fetchErr || !original) return NextResponse.json({ error: fetchErr?.message ?? "Introuvable" }, { status: 404 })

  // Generate new number
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const { count } = await db.from("invoices").select("*", { count: "exact", head: true })
  const seq = String((count ?? 0) + 1).padStart(4, "0")
  const number = `FAC-${year}-${month}-${seq}`

  // Create new draft invoice
  const { data: newInvoice, error: insertErr } = await db
    .from("invoices")
    .insert([{
      account_id: original.account_id,
      currency: original.currency,
      notes: original.notes,
      status: "draft",
      number,
      issue_date: now.toISOString().split("T")[0],
    }])
    .select("id")
    .single()

  if (insertErr || !newInvoice) return NextResponse.json({ error: insertErr?.message ?? "Erreur création" }, { status: 400 })

  // Copy lines
  if (original.lines?.length > 0) {
    await db.from("invoice_lines").insert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (original.lines as any[]).map((l, i) => ({
        invoice_id: newInvoice.id,
        description: l.description,
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount: l.discount,
        tva_rate: l.tva_rate,
        position: l.position ?? i,
      }))
    )
  }

  return NextResponse.json({ id: newInvoice.id })
}
