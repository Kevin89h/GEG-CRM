import { NextRequest, NextResponse } from "next/server"
import { createSchemaClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params
  const schema = getSchemaFromRequest(req)
  const db = createSchemaClient(schema)

  // Récupérer le paiement avant suppression pour nettoyer la trésorerie
  const { data: payment } = await db
    .from("supplier_payments")
    .select("amount, currency, treasury_account_id, paid_at, reference")
    .eq("id", paymentId)
    .eq("supplier_invoice_id", id)
    .single()

  const { error: delErr } = await db
    .from("supplier_payments")
    .delete()
    .eq("id", paymentId)
    .eq("supplier_invoice_id", id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

  // Supprimer la transaction trésorerie correspondante
  if (payment?.treasury_account_id) {
    await createSchemaClient(schema)
      .from("treasury_transactions")
      .delete()
      .eq("account_id", payment.treasury_account_id)
      .eq("amount", payment.amount)
      .eq("type", "debit")
      .eq("category", "supplier_payment")
  }

  const { data: allPayments } = await db
    .from("supplier_payments")
    .select("amount, currency, exchange_rate")
    .eq("supplier_invoice_id", id)

  const { data: inv } = await db.from("supplier_invoices").select("total_ttc, currency").eq("id", id).single()
  if (!inv) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

  const invoiceCurrency = inv.currency ?? "GNF"
  const totalPaid = (allPayments ?? []).reduce((s, p) => {
    const amt = Number(p.amount)
    if (p.currency && p.currency !== invoiceCurrency && p.exchange_rate) {
      return s + amt / Number(p.exchange_rate)
    }
    return s + amt
  }, 0)
  const balance = Number(inv.total_ttc) - totalPaid
  const newStatus = balance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending"
  await db.from("supplier_invoices").update({ status: newStatus }).eq("id", id)

  return NextResponse.json({ ok: true, totalPaid, newStatus, balance })
}
