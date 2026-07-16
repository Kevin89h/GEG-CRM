import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import QRCode from "qrcode"
import FacturePrintPage from "@/app/[locale]/(app)/ventes/factures/[id]/pdf/FacturePrintPage"
import PrintPage from "@/app/[locale]/(app)/ventes/devis/[id]/pdf/PrintPage"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function companyDb(): any {
  return adminClient().schema("geg_guinee")
}

export default async function PublicPdfPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = adminClient()

  const { data: tokenRow } = await admin
    .from("document_tokens")
    .select("document_id, document_type, expires_at")
    .eq("token", token)
    .maybeSingle()

  if (!tokenRow) notFound()
  if (new Date(tokenRow.expires_at) < new Date()) notFound()

  const db = companyDb()
  const id = tokenRow.document_id

  // Shared: company doc settings
  const { data: company } = await admin.from("companies").select("id").eq("schema_name", "geg_guinee").single()
  const { data: docSettings } = company
    ? await admin.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const { data: bankAccounts } = await db
    .from("treasury_accounts")
    .select("institution, account_number, swift, iban, currency")
    .eq("type", "bank")
    .eq("is_active", true)
    .order("name")

  const banks = (bankAccounts ?? []).map((a: Record<string, string | null>) => ({
    institution: a.institution ?? null,
    account_number: a.account_number ?? null,
    swift: a.swift ?? null,
    iban: a.iban ?? null,
    currency: a.currency ?? null,
  }))

  // ── FACTURE ─────────────────────────────────────────────
  if (tokenRow.document_type === "facture") {
    const { data: invoice } = await db
      .from("invoices")
      .select(`id, number, status, currency, issue_date, due_date, notes, order_id,
        account:accounts(id, name, city, country, phone),
        lines:invoice_lines(id, description, quantity, unit_price, discount, position, tva_rate, product:products(id, name, reference))`)
      .eq("id", id)
      .single()

    if (!invoice) notFound()

    const { data: payments } = await db.from("payments").select("amount, paid_at").eq("invoice_id", id).order("paid_at")

    const account = Array.isArray(invoice.account) ? invoice.account[0] : invoice.account
    const rawLines = ((invoice.lines ?? []) as Record<string, unknown>[]).sort((a, b) => (a.position as number) - (b.position as number))
    const lines = rawLines.map((l: Record<string, unknown>) => ({
      id: String(l.id ?? ""),
      description: String(l.description ?? ""),
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unit_price) || 0,
      discount: Number(l.discount) || 0,
      tva_rate: l.tva_rate != null ? Number(l.tva_rate) : null,
      image_url: null,
      product: Array.isArray(l.product) ? (l.product[0] ?? null) : l.product as { name: string; reference: string | null } | null,
    }))

    const paymentList = (payments ?? []).map((p: { amount: number; paid_at: string }) => ({ amount: Number(p.amount) || 0, paid_at: String(p.paid_at ?? "") }))
    const totalHT = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100), 0)
    const totalPaid = paymentList.reduce((s: number, p: { amount: number }) => s + p.amount, 0)
    const balance = totalHT - totalPaid

    const qrContent = [`FACTURE:${invoice.number}`, `CLIENT:${account?.name ?? ""}`, `MONTANT:${Math.round(totalHT)} ${invoice.currency}`, balance > 0 ? `SOLDE:${Math.round(balance)} ${invoice.currency}` : `SOLDE:REGLE`].join("\n")
    const qrSvg = await QRCode.toString(qrContent, { type: "svg", margin: 1, width: 120, color: { dark: "#1e3a5f", light: "#ffffff" } })

    return (
      <FacturePrintPage
        id={id} number={String(invoice.number)} status={String(invoice.status)}
        currency={String(invoice.currency)} issueDate={String(invoice.issue_date ?? "")}
        dueDate={invoice.due_date ? String(invoice.due_date) : null}
        notes={invoice.notes ? String(invoice.notes) : null}
        sourceRef={invoice.order_id ? String(invoice.order_id) : null}
        accountName={account?.name ?? "—"} accountCity={account?.city ?? null}
        accountCountry={account?.country ?? null} accountPhone={account?.phone ?? null}
        lines={lines} payments={paymentList} qrSvg={qrSvg} locale="fr"
        docSettings={docSettings ?? null} bankAccounts={banks}
      />
    )
  }

  // ── DEVIS ────────────────────────────────────────────────
  if (tokenRow.document_type === "devis") {
    const { data: order } = await db
      .from("sales_orders")
      .select("id, number, status, currency, valid_until, notes, created_at, account_id, tva, payment_terms")
      .eq("id", id)
      .single()

    if (!order) notFound()

    const [{ data: account }, { data: rawLines }] = await Promise.all([
      order.account_id ? db.from("accounts").select("id, name, country").eq("id", order.account_id).single() : Promise.resolve({ data: null }),
      db.from("sales_order_lines").select("id, description, quantity, unit_price, discount, position, tva_exempt").eq("order_id", id).order("position"),
    ])

    const orderTva = Boolean(order.tva)
    const lines = ((rawLines ?? []) as Record<string, unknown>[]).map((l) => ({
      id: String(l.id ?? ""),
      description: String(l.description ?? ""),
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unit_price) || 0,
      discount: Number(l.discount) || 0,
      tva_rate: orderTva && !l.tva_exempt ? 18 : 0,
      image_url: null,
      product: null,
    }))

    return (
      <PrintPage
        id={id} number={String(order.number)} status={String(order.status ?? "draft")}
        currency={String(order.currency)} createdAt={String(order.created_at ?? "")}
        validUntil={order.valid_until ? String(order.valid_until) : null}
        notes={order.notes ? String(order.notes) : null}
        deliveryAddress={null} paymentTerms={order.payment_terms ? String(order.payment_terms) : null}
        accountName={(account as Record<string, string> | null)?.name ?? "—"}
        accountCountry={(account as Record<string, string> | null)?.country ?? null}
        salespersonName={null} lines={lines} locale="fr" docType="devis"
        docSettings={docSettings ?? null} bankAccounts={banks}
      />
    )
  }

  notFound()
}
