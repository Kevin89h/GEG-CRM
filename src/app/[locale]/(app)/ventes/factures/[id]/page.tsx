import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import { notFound } from "next/navigation"
import FactureDetailClient from "./FactureDetailClient"

export default async function FactureDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  let { db, schema } = await createCompanyClient()
  const publicSupa = await createClient()

  // Try to find the invoice in the current schema; fall back to geg_guinee if needed
  let { data: inv } = await db.from("invoices").select("id, number, status, currency, account_id, issue_date, due_date, notes").eq("id", id).single()

  if (!inv && schema !== "geg_guinee") {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallbackDb = (supabase as any).schema("geg_guinee") as typeof supabase
    const { data: fallbackInv } = await fallbackDb.from("invoices").select("id, number, status, currency, account_id, issue_date, due_date, notes").eq("id", id).single()
    if (fallbackInv) {
      inv = fallbackInv
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db = fallbackDb as any
      schema = "geg_guinee"
    }
  }

  if (!inv) notFound()

  const { data: company } = await publicSupa.from("companies").select("id").eq("schema_name", schema).single()
  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const [{ data: lines }, { data: payments }, { data: treasuryAccounts }] = await Promise.all([
    db.from("invoice_lines")
      .select("id, product_id, description, quantity, unit_price, discount, position, tva_rate")
      .eq("invoice_id", id)
      .order("position"),
    db.from("payments")
      .select("id, amount, currency, method, reference, notes, paid_at, exchange_rate, amount_in_invoice_currency")
      .eq("invoice_id", id)
      .order("paid_at", { ascending: false }),
    db.from("treasury_accounts")
      .select("id, name, type, currency")
      .eq("is_active", true)
      .order("name"),
  ])

  const warehouses: { id: string; name: string; city: string | null }[] = []
  const deliveryNotes: { id: string; number: string; status: string; delivery_date: string | null }[] = []

  const { data: account } = inv.account_id
    ? await db.from("accounts").select("name, country").eq("id", inv.account_id).single()
    : { data: null }

  // Calcul totaux depuis les lignes
  const linesData = lines ?? []
  const total_ht = linesData.reduce((s, l) => {
    return s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (1 - (Number(l.discount) || 0) / 100)
  }, 0)
  const total_ttc = linesData.reduce((s, l) => {
    const lineHT = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (1 - (Number(l.discount) || 0) / 100)
    return s + lineHT * (1 + (Number(l.tva_rate) || 0) / 100)
  }, 0)
  const total_paid = (payments ?? []).reduce((s, p) =>
    s + Number(p.amount_in_invoice_currency ?? p.amount), 0)
  const balance = total_ttc - total_paid

  const invoice = {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    currency: inv.currency,
    issue_date: inv.issue_date,
    due_date: inv.due_date ?? null,
    notes: inv.notes ?? null,
    total_ht,
    total_ttc,
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
