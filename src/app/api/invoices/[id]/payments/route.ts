import { createCompanyClient } from "@/lib/company"
import { logActivity } from "@/lib/activity-logger"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { amount, currency, method, treasury_account_id, reference, notes, paid_at, user_id } = body

    if (!amount || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 })

    const { db } = await createCompanyClient()

    const { data: payment, error: payErr } = await db
      .from("payments")
      .insert([{
        invoice_id: id,
        amount,
        currency,
        method,
        treasury_account_id: treasury_account_id || null,
        reference: reference || null,
        notes: notes || null,
        paid_at: new Date(paid_at).toISOString(),
        user_id,
      }])
      .select("*")
      .single()

    if (payErr || !payment) return NextResponse.json({ error: payErr?.message ?? "Erreur" }, { status: 500 })

    // Recalculate balance and update status
    const { data: inv } = await db
      .from("invoice_totals")
      .select("total_ht, total_paid, balance")
      .eq("id", id)
      .single()

    if (inv) {
      const newStatus = inv.balance <= 0 ? "paid" : inv.total_paid > 0 ? "partial" : "sent"
      await db.from("invoices").update({ status: newStatus }).eq("id", id)
    }

    logActivity({ action: "payment", resource: "invoice", resourceId: id, label: `Paiement de ${amount} ${currency ?? ""} enregistré sur facture`, details: { amount, currency, method } })
    return NextResponse.json({ payment })
  } catch (err) {
    console.error("Payment error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
