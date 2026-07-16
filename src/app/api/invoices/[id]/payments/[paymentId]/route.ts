import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient, getCompanySchema } from "@/lib/company"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params
  const { db } = await createCompanyClient()

  // Récupérer le paiement avant suppression pour nettoyer la trésorerie
  const { data: payment } = await db
    .from("payments")
    .select("amount, currency, treasury_account_id, paid_at, reference")
    .eq("id", paymentId)
    .eq("invoice_id", id)
    .single()

  const { error: delErr } = await db.from("payments").delete().eq("id", paymentId).eq("invoice_id", id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

  // Supprimer la transaction trésorerie correspondante
  if (payment?.treasury_account_id) {
    const schema = await getCompanySchema()
    const adminRaw = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = (adminRaw as any).schema(schema) as typeof adminRaw
    await adminDb
      .from("treasury_transactions")
      .delete()
      .eq("account_id", payment.treasury_account_id)
      .eq("amount", payment.amount)
      .eq("type", "credit")
      .eq("category", "invoice_payment")
  }

  const { data: remaining } = await db
    .from("payments")
    .select("amount, amount_in_invoice_currency")
    .eq("invoice_id", id)
  const { data: inv } = await db.from("invoices").select("id").eq("id", id).single()
  if (!inv) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

  const totalPaid = (remaining ?? []).reduce((s, p) =>
    s + Number(p.amount_in_invoice_currency ?? p.amount), 0)
  const newStatus = totalPaid <= 0 ? "sent" : "partial"
  await db.from("invoices").update({ status: newStatus }).eq("id", id)

  return NextResponse.json({ ok: true, totalPaid, newStatus })
}
