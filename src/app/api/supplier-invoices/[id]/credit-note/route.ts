import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()

  const { data: invoice } = await db
    .from("supplier_invoices")
    .select("number, supplier_name, currency, total_ht, tax_amount, total_ttc, invoice_date")
    .eq("id", id)
    .single()

  if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

  const { data: lines } = await db
    .from("supplier_invoice_lines")
    .select("description, quantity, unit_price, tax_rate, position")
    .eq("invoice_id", id)
    .order("position")

  const { count } = await db.from("supplier_invoices").select("id", { count: "exact", head: true })
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const seq = String((count ?? 0) + 1).padStart(4, "0")
  const number = `AFF-${year}-${month}-${seq}`

  const { data: creditNote, error } = await db
    .from("supplier_invoices")
    .insert([{
      number,
      supplier_name: invoice.supplier_name,
      currency: invoice.currency,
      invoice_date: now.toISOString().split("T")[0],
      total_ht: -(Number(invoice.total_ht)),
      tax_amount: -(Number(invoice.tax_amount)),
      total_ttc: -(Number(invoice.total_ttc)),
      status: "pending",
      notes: `Avoir sur facture fournisseur ${invoice.number}`,
    }])
    .select("id")
    .single()

  if (error || !creditNote) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 })

  if (lines?.length) {
    await db.from("supplier_invoice_lines").insert(
      lines.map((l, i) => ({
        invoice_id: creditNote.id,
        description: l.description,
        quantity: -(Number(l.quantity)),
        unit_price: Number(l.unit_price),
        tax_rate: Number(l.tax_rate),
        position: i,
      }))
    )
  }

  return NextResponse.json({ id: creditNote.id, number })
}
