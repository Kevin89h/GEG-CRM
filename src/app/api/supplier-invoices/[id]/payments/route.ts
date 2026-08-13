import { createSchemaClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"
import { logActivity } from "@/lib/activity-logger"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { amount, currency, exchange_rate, method, treasury_account_id, reference, notes, paid_at } = body

    if (!amount || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 })

    const schema = getSchemaFromRequest(req)
    const db = createSchemaClient(schema)

    const { data: invoice } = await db
      .from("supplier_invoices")
      .select("total_ttc, status, number, currency")
      .eq("id", id)
      .single()

    if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

    const parsedExchangeRate = exchange_rate ? parseFloat(exchange_rate) : null

    const { data: payment, error: payErr } = await db
      .from("supplier_payments")
      .insert([{
        supplier_invoice_id: id,
        amount,
        currency,
        exchange_rate: parsedExchangeRate,
        method,
        treasury_account_id: treasury_account_id || null,
        reference: reference || null,
        notes: notes || null,
        paid_at: new Date(paid_at).toISOString(),
      }])
      .select("*")
      .single()

    if (payErr || !payment) return NextResponse.json({ error: payErr?.message ?? "Erreur" }, { status: 500 })

    const { data: allPayments } = await db
      .from("supplier_payments")
      .select("amount, currency, exchange_rate")
      .eq("supplier_invoice_id", id)

    const invoiceCurrency = invoice.currency ?? "GNF"
    const totalPaid = (allPayments ?? []).reduce((s, p) => {
      const amt = Number(p.amount)
      if (p.currency && p.currency !== invoiceCurrency && p.exchange_rate) {
        return s + amt / Number(p.exchange_rate)
      }
      return s + amt
    }, 0)
    const balance = Number(invoice.total_ttc) - totalPaid
    const newStatus = balance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending"
    await db.from("supplier_invoices").update({ status: newStatus }).eq("id", id)

    if (treasury_account_id) {
      const { error: txErr } = await createSchemaClient(schema).from("treasury_transactions").insert([{
        account_id: treasury_account_id,
        type: "debit",
        amount,
        currency,
        description: `Paiement facture fournisseur — ${invoice.number ?? id}${reference ? ` (${reference})` : ""}`,
        date: new Date(paid_at).toISOString(),
        reference: reference || null,
        category: "supplier_payment",
      }])
      if (txErr) console.error("Treasury insert error:", txErr.message)
    }

    logActivity({ action: "payment", resource: "achat", resourceId: id, label: `Paiement de ${Number(amount).toLocaleString("fr")} ${currency} enregistré — ${invoice.number ?? id}`, details: { amount, currency, method } })
    return NextResponse.json({ payment, newStatus, balance })
  } catch (err) {
    console.error("Supplier payment error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createSchemaClient(getSchemaFromRequest(req))
  const { data: payments } = await db
    .from("supplier_payments")
    .select("*")
    .eq("supplier_invoice_id", id)
    .order("paid_at", { ascending: false })
  return NextResponse.json({ payments: payments ?? [] })
}
