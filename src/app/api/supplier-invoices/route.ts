import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      supplier_name, currency, invoice_date, due_date, reference, notes,
      total_ht, tax_amount, total_ttc, status,
      lines,
      pay_immediately, treasury_account_id, payment_method,
      purchase_order_id, reception_id,
    } = body

    if (!supplier_name?.trim()) {
      return NextResponse.json({ error: "Le nom du fournisseur est requis" }, { status: 400 })
    }

    const { db } = await createCompanyClient()

    const { count } = await db.from("supplier_invoices").select("id", { count: "exact", head: true })
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const seq = String((count ?? 0) + 1).padStart(4, "0")
    const number = `FF-${year}-${month}-${seq}`

    const { data: invoice, error: invErr } = await db
      .from("supplier_invoices")
      .insert([{
        number,
        supplier_name: supplier_name.trim(),
        currency,
        invoice_date,
        due_date: due_date || null,
        reference: reference || null,
        notes: notes || null,
        total_ht,
        tax_amount,
        total_ttc,
        status,
        purchase_order_id: purchase_order_id || null,
        reception_id: reception_id || null,
      }])
      .select("id")
      .single()

    if (invErr || !invoice) {
      return NextResponse.json({ error: invErr?.message ?? "Erreur création facture" }, { status: 500 })
    }

    if (lines?.length > 0) {
      const { error: linesErr } = await db.from("supplier_invoice_lines").insert(
        lines.map((l: { description: string; quantity: number; unit_price: number; tax_rate: number }, i: number) => ({
          invoice_id: invoice.id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          position: i,
        }))
      )
      if (linesErr) {
        return NextResponse.json({ error: linesErr.message }, { status: 500 })
      }
    }

    if (pay_immediately && treasury_account_id) {
      await db.from("treasury_transactions").insert([{
        account_id: treasury_account_id,
        type: "debit",
        amount: total_ttc,
        currency,
        description: `Paiement facture fournisseur ${number} — ${supplier_name}`,
        reference: reference || number,
        category: "achat",
        date: invoice_date,
      }])
    }

    return NextResponse.json({ id: invoice.id, number })
  } catch (err) {
    console.error("Supplier invoice create error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
