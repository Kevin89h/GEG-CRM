import { createClient } from "@/lib/supabase/server"
import { createSchemaClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"
import { logActivity } from "@/lib/activity-logger"
import { NextRequest, NextResponse } from "next/server"
import { roundAmount } from "@/lib/document-rates-shared"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { amount, currency, exchange_rate, amount_in_invoice_currency, method, treasury_account_id, reference, notes, paid_at } = body

    if (!amount || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 })

    // Permission "paiements_clients.enregistrer" in the active company: checked by the middleware
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const schema = await getSchemaFromRequest(req)
    const db = createSchemaClient(schema)

    // D-11: a payment in another currency stores the rate ACTUALLY applied (reference rate or the bank / contractual
    // rate entered) and the amount credited on the invoice is recomputed here from that rate, rounded to the invoice
    // currency. Existing payments are never recalculated. Bank fees are not part of the rate (recorded separately).
    const { data: inv } = await db.from("invoices").select("currency").eq("id", id).single()
    const invoiceCurrency = inv?.currency ?? currency
    const cross = !!currency && currency !== invoiceCurrency
    const rate = cross ? Number(exchange_rate) : null
    if (cross && !(rate! > 0)) return NextResponse.json({ error: "Taux de change requis pour un paiement dans une autre devise" }, { status: 400 })
    const credited = cross ? roundAmount(Number(amount) * rate!, invoiceCurrency) : (amount_in_invoice_currency ?? null)

    const { data: payment, error: payErr } = await db
      .from("payments")
      .insert([{
        invoice_id: id,
        amount,
        currency,
        exchange_rate: cross ? rate : (exchange_rate ?? null),
        amount_in_invoice_currency: credited,
        method,
        treasury_account_id: treasury_account_id || null,
        reference: reference || null,
        notes: notes || null,
        paid_at: new Date(paid_at).toISOString(),
        user_id: user.id,
      }])
      .select("*")
      .single()

    if (payErr || !payment) return NextResponse.json({ error: payErr?.message ?? "Erreur" }, { status: 500 })

    // Treasury operation explicitly linked to this payment (payment_id); if it fails, the payment is withdrawn
    if (treasury_account_id) {
      const { data: invoice } = await db.from("invoices").select("number").eq("id", id).single()
      const { error: txErr } = await createSchemaClient(schema).from("treasury_transactions").insert([{
        account_id: treasury_account_id,
        type: "credit",
        amount,
        currency,
        description: `Paiement facture client — ${invoice?.number ?? id}${reference ? ` (${reference})` : ""}`,
        reference: reference || null,
        category: "invoice_payment",
        date: new Date(paid_at).toISOString(),
        user_id: user.id,
        payment_id: payment.id,
      }])
      if (txErr) {
        await db.from("payments").delete().eq("id", payment.id)
        return NextResponse.json({ error: `Opération de trésorerie impossible, paiement non enregistré : ${txErr.message}` }, { status: 500 })
      }
    }

    // Recalculate balance using amount_in_invoice_currency when currencies differ
    const { data: allPayments } = await db
      .from("payments")
      .select("amount, amount_in_invoice_currency")
      .eq("invoice_id", id)
    const { data: invLines } = await db
      .from("invoice_lines")
      .select("quantity, unit_price, discount, tva_rate")
      .eq("invoice_id", id)

    const totalPaid = (allPayments ?? []).reduce((s, p) =>
      s + Number(p.amount_in_invoice_currency ?? p.amount), 0)
    const totalTTC = (invLines ?? []).reduce((s, l) => {
      const ht = Number(l.quantity) * Number(l.unit_price) * (1 - Number(l.discount ?? 0) / 100)
      return s + ht * (1 + Number(l.tva_rate ?? 0) / 100)
    }, 0)
    const newStatus = totalPaid >= totalTTC - 0.005 ? "paid" : totalPaid > 0 ? "partial" : "sent"
    await db.from("invoices").update({ status: newStatus }).eq("id", id)

    logActivity({ action: "payment", resource: "invoice", resourceId: id, label: `Paiement de ${amount} ${currency ?? ""} enregistré sur facture`, details: { amount, currency, method } })
    return NextResponse.json({ payment })
  } catch (err) {
    console.error("Payment error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
