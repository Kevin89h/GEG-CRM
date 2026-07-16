import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createCompanyClient } from "@/lib/company"
import { getCompanySchema } from "@/lib/company"
import { logActivity } from "@/lib/activity-logger"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { amount, currency, exchange_rate, amount_in_invoice_currency, method, treasury_account_id, reference, notes, paid_at, user_id } = body

    if (!amount || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 })

    // Check user has permission to create payments (ventes.create)
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { data: profile } = await supabaseAuth.from("profiles").select("role, permissions").eq("id", user.id).single()
    if (profile?.role !== "admin") {
      const perm = profile?.permissions?.ventes
      if (perm && !perm.create) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const { db } = await createCompanyClient()

    const { data: payment, error: payErr } = await db
      .from("payments")
      .insert([{
        invoice_id: id,
        amount,
        currency,
        exchange_rate: exchange_rate ?? null,
        amount_in_invoice_currency: amount_in_invoice_currency ?? null,
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
    const newStatus = totalPaid >= totalTTC ? "paid" : totalPaid > 0 ? "partial" : "sent"
    await db.from("invoices").update({ status: newStatus }).eq("id", id)

    // Créer une transaction trésorerie (crédit) via le client admin (bypass RLS)
    if (treasury_account_id) {
      const { data: invoice } = await db.from("invoices").select("number").eq("id", id).single()
      const schema = await getCompanySchema()
      const adminRaw = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adminDb = (adminRaw as any).schema(schema) as typeof adminRaw
      const { error: txErr } = await adminDb.from("treasury_transactions").insert([{
        account_id: treasury_account_id,
        type: "credit",
        amount,
        currency,
        description: `Paiement facture client — ${invoice?.number ?? id}${reference ? ` (${reference})` : ""}`,
        reference: reference || null,
        category: "invoice_payment",
        date: new Date(paid_at).toISOString(),
        user_id: user.id,
      }])
      if (txErr) console.error("Treasury insert error:", txErr.message)
    }

    logActivity({ action: "payment", resource: "invoice", resourceId: id, label: `Paiement de ${amount} ${currency ?? ""} enregistré sur facture`, details: { amount, currency, method } })
    return NextResponse.json({ payment })
  } catch (err) {
    console.error("Payment error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
