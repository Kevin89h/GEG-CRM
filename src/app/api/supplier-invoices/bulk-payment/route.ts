import { NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { invoice_ids, amount, currency, method, paid_at, reference, notes } = body as {
      invoice_ids: string[]
      amount: number
      currency: string
      method: string
      paid_at: string
      reference?: string
      notes?: string
    }

    if (!invoice_ids?.length) return NextResponse.json({ error: "Aucune facture sélectionnée" }, { status: 400 })
    if (!amount || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 })

    const { db } = await createCompanyClient()

    // Load invoices sorted by date (oldest first)
    const { data: invoices, error: fetchErr } = await db
      .from("supplier_invoices")
      .select("id, number, total_ttc")
      .in("id", invoice_ids)
      .order("invoice_date", { ascending: true })

    if (fetchErr || !invoices) return NextResponse.json({ error: fetchErr?.message ?? "Erreur" }, { status: 500 })

    // Fetch existing payments
    const { data: existingPayments } = await db
      .from("supplier_payments")
      .select("supplier_invoice_id, amount")
      .in("supplier_invoice_id", invoice_ids)

    function alreadyPaid(invoiceId: string) {
      return (existingPayments ?? [])
        .filter(p => p.supplier_invoice_id === invoiceId)
        .reduce((s, p) => s + Number(p.amount), 0)
    }

    let remaining = amount
    const results = []

    for (const inv of invoices) {
      if (remaining <= 0) break
      const totalTTC = Number(inv.total_ttc)
      const paid = alreadyPaid(inv.id)
      const balance = totalTTC - paid
      if (balance <= 0) continue

      const paymentAmount = Math.min(remaining, balance)
      remaining -= paymentAmount

      const { data: payment, error: payErr } = await db
        .from("supplier_payments")
        .insert([{
          supplier_invoice_id: inv.id,
          amount: paymentAmount,
          currency,
          method,
          reference: reference || null,
          notes: notes || null,
          paid_at: new Date(paid_at).toISOString(),
        }])
        .select("id")
        .single()

      if (payErr || !payment) {
        results.push({ id: inv.id, number: inv.number, error: payErr?.message })
        continue
      }

      const newTotalPaid = paid + paymentAmount
      const newBalance = totalTTC - newTotalPaid
      const newStatus = newBalance <= 0 ? "paid" : newTotalPaid > 0 ? "partial" : "pending"
      await db.from("supplier_invoices").update({ status: newStatus }).eq("id", inv.id)

      results.push({ id: inv.id, number: inv.number, paid: paymentAmount, status: newStatus })
    }

    return NextResponse.json({ results, remaining })
  } catch (err) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
