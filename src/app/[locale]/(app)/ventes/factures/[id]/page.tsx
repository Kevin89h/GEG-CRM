import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import { notFound } from "next/navigation"
import FactureDetailClient from "./FactureDetailClient"

export default async function FactureDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()
  const publicSupa = await createClient()
  const schema = await getCompanySchema()
  const { data: company } = await publicSupa.from("companies").select("id").eq("schema_name", schema).single()
  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const [{ data: inv }, { data: lines }, { data: payments }, { data: treasuryAccounts }] = await Promise.all([
    db.from("invoices")
      .select("id, number, status, currency, account_id, issue_date, due_date, notes")
      .eq("id", id)
      .single(),
    db.from("invoice_lines")
      .select("id, product_id, description, quantity, unit_price, discount, position")
      .eq("invoice_id", id)
      .order("position"),
    db.from("payments")
      .select("id, amount, currency, method, reference, notes, paid_at")
      .eq("invoice_id", id)
      .order("paid_at", { ascending: false }),
    db.from("treasury_accounts")
      .select("id, name, type, currency")
      .eq("is_active", true)
      .order("name"),
  ])

  const warehouses: { id: string; name: string; city: string | null }[] = []
  const deliveryNotes: { id: string; number: string; status: string; delivery_date: string | null }[] = []

  if (!inv) notFound()

  const { data: account } = inv.account_id
    ? await db.from("accounts").select("name, country").eq("id", inv.account_id).single()
    : { data: null }

  // Calcul totaux depuis les lignes
  const linesData = lines ?? []
  const total_ht = linesData.reduce((s, l) => {
    return s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (1 - (Number(l.discount) || 0) / 100)
  }, 0)
  const total_paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const balance = total_ht - total_paid

  const invoice = {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    currency: inv.currency,
    issue_date: inv.issue_date,
    due_date: inv.due_date ?? null,
    notes: inv.notes ?? null,
    total_ht,
    total_paid,
    balance,
    account: account ?? null,
    lines: linesData,
    payments: payments ?? [],
  }

  return (
    <FactureDetailClient
      invoice={invoice}
      locale={locale}
      treasuryAccounts={treasuryAccounts ?? []}
      warehouses={warehouses}
      deliveryNotes={deliveryNotes}
      docSettings={docSettings ?? {}}
    />
  )
}
