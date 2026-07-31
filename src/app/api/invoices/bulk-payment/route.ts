import { NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"

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

    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { db } = await createCompanyClient()

    // Load invoices sorted by issue_date (oldest first)
    const { data: invoices, error: fetchErr } = await db
      .from("invoices")
      .select("id, number, status, issue_date, lines:invoice_lines(quantity, unit_price, discount, tva_rate)")
      .in("id", invoice_ids)
      .order("issue_date", { ascending: true })

    if (fetchErr || !invoices) return NextResponse.json({ error: fetchErr?.message ?? "Erreur" }, { status: 500 })

    // Fetch existing payments for each invoice
    const { data: existingPayments } = await db
      .from("payments")
      .select("invoice_id, amount, amount_in_invoice_currency")
      .in("invoice_id", invoice_ids)

    function invoiceTotalTTC(inv: { lines: { quantity: number; unit_price: number; discount: number; tva_rate: number }[] }) {
      return (inv.lines ?? []).reduce((s, l) => {
        const ht = Number(l.quantity) * Number(l.unit_price) * (1 - Number(l.discount ?? 0) / 100)
        return s + ht * (1 + Number(l.tva_rate ?? 0) / 100)
      }, 0)
    }

    function invoicePaid(invoiceId: string) {
      return (existingPayments ?? [])
        .filter(p => p.invoice_id === invoiceId)
        .reduce((s, p) => s + Number(p.amount_in_invoice_currency ?? p.amount), 0)
    }

    // Distribute amount across invoices oldest-first
    let remaining = amount
    const results = []

    for (const inv of invoices) {
      if (remaining <= 0) break
      const totalTTC = invoiceTotalTTC(inv as { lines: { quantity: number; unit_price: number; discount: number; tva_rate: number }[] })
      const alreadyPaid = invoicePaid(inv.id)
      const balance = totalTTC - alreadyPaid
      if (balance <= 0) continue

      const paymentAmount = Math.min(remaining, balance)
      remaining -= paymentAmount

      const { data: payment, error: payErr } = await db
        .from("payments")
        .insert([{
          invoice_id: inv.id,
          amount: paymentAmount,
          currency,
          method,
          reference: reference || null,
          notes: notes || null,
          paid_at: new Date(paid_at).toISOString(),
          user_id: user.id,
        }])
        .select("id")
        .single()

      if (payErr || !payment) {
        results.push({ id: inv.id, number: inv.number, error: payErr?.message })
        continue
      }

      // Recalculate status
      const newTotalPaid = alreadyPaid + paymentAmount
      const newStatus = newTotalPaid >= totalTTC ? "paid" : newTotalPaid > 0 ? "partial" : "sent"
      await db.from("invoices").update({ status: newStatus }).eq("id", inv.id)

      results.push({ id: inv.id, number: inv.number, paid: paymentAmount, status: newStatus })
    }

    return NextResponse.json({ results, remaining })
  } catch (err) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
