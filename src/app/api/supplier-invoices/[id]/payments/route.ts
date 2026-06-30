import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { amount, currency, method, treasury_account_id, reference, notes, paid_at } = body

    if (!amount || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 })

    const { db } = await createCompanyClient()

    // Récupérer la facture pour connaître le total
    const { data: invoice } = await db
      .from("supplier_invoices")
      .select("total_ttc, status")
      .eq("id", id)
      .single()

    if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

    // Insérer le paiement
    const { data: payment, error: payErr } = await db
      .from("supplier_payments")
      .insert([{
        supplier_invoice_id: id,
        amount,
        currency,
        method,
        treasury_account_id: treasury_account_id || null,
        reference: reference || null,
        notes: notes || null,
        paid_at: new Date(paid_at).toISOString(),
      }])
      .select("*")
      .single()

    if (payErr || !payment) return NextResponse.json({ error: payErr?.message ?? "Erreur" }, { status: 500 })

    // Recalculer le total payé et mettre à jour le statut
    const { data: allPayments } = await db
      .from("supplier_payments")
      .select("amount")
      .eq("supplier_invoice_id", id)

    const totalPaid = (allPayments ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const balance = Number(invoice.total_ttc) - totalPaid

    const newStatus = balance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending"
    await db.from("supplier_invoices").update({ status: newStatus }).eq("id", id)

    // Créer une transaction trésorerie (débit) si un compte est sélectionné
    if (treasury_account_id) {
      await db.from("treasury_transactions").insert([{
        account_id: treasury_account_id,
        type: "debit",
        amount,
        currency,
        description: `Paiement facture fournisseur — ref: ${reference || id}`,
        transaction_date: new Date(paid_at).toISOString(),
        reference: reference || null,
      }])
    }

    return NextResponse.json({ payment, newStatus, balance })
  } catch (err) {
    console.error("Supplier payment error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()
  const { data: payments } = await db
    .from("supplier_payments")
    .select("*")
    .eq("supplier_invoice_id", id)
    .order("paid_at", { ascending: false })
  return NextResponse.json({ payments: payments ?? [] })
}
