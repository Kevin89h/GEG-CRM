import { createCompanyClient, getCompanySchema } from "@/lib/company"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { amount, currency, method, treasury_account_id, reference, notes, paid_at } = body

    if (!amount || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 })

    const { db } = await createCompanyClient()

    const { data: invoice } = await db
      .from("supplier_invoices")
      .select("total_ttc, status, number")
      .eq("id", id)
      .single()

    if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

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

    const { data: allPayments } = await db
      .from("supplier_payments")
      .select("amount")
      .eq("supplier_invoice_id", id)

    const totalPaid = (allPayments ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const balance = Number(invoice.total_ttc) - totalPaid
    const newStatus = balance <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending"
    await db.from("supplier_invoices").update({ status: newStatus }).eq("id", id)

    if (treasury_account_id) {
      const schema = await getCompanySchema()
      const adminRaw = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adminDb = (adminRaw as any).schema(schema) as typeof adminRaw
      const { error: txErr } = await adminDb.from("treasury_transactions").insert([{
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
