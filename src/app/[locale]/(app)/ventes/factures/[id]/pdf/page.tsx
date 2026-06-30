import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import { notFound } from "next/navigation"
import QRCode from "qrcode"
import FacturePrintPage from "./FacturePrintPage"

export default async function FacturePdfPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()
  const publicSupa = await createClient()
  const schema = await getCompanySchema()

  const { data: company } = await publicSupa
    .from("companies")
    .select("id")
    .eq("schema_name", schema)
    .single()

  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const { data: invoice } = await db
    .from("invoices")
    .select(`
      id, number, status, currency, issue_date, due_date, notes, order_id,
      account:accounts(id, name, city, country, phone),
      lines:invoice_lines(id, description, quantity, unit_price, discount, position, product:products(name, reference))
    `)
    .eq("id", id)
    .single()

  if (!invoice) notFound()

  const [{ data: payments }, { data: bankAccounts }] = await Promise.all([
    db.from("payments").select("amount, paid_at").eq("invoice_id", id).order("paid_at"),
    db.from("treasury_accounts")
      .select("name, institution, account_number, currency")
      .eq("type", "bank")
      .eq("is_active", true)
      .order("currency")
      .order("name"),
  ])

  const account = Array.isArray(invoice.account) ? invoice.account[0] : invoice.account
  const acc = account as Record<string, string | null> | null

  const lines = ((invoice.lines ?? []) as Record<string, unknown>[])
    .sort((a, b) => (a.position as number) - (b.position as number))
    .map(l => ({
      id: String(l.id ?? ""),
      description: String(l.description ?? ""),
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unit_price) || 0,
      discount: Number(l.discount) || 0,
      tva_rate: null as number | null,
      product: Array.isArray(l.product)
        ? (l.product[0] ?? null)
        : (l.product as { name: string; reference: string | null } | null),
    }))

  const paymentList = (payments ?? []).map(p => ({
    amount: Number(p.amount) || 0,
    paid_at: String(p.paid_at ?? ""),
  }))

  const totalHT = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100), 0)
  const totalPaid = paymentList.reduce((s, p) => s + p.amount, 0)
  const balance = totalHT - totalPaid

  // QR code content — structured invoice summary
  const qrContent = [
    `FACTURE:${invoice.number}`,
    `CLIENT:${acc?.name ?? ""}`,
    `DATE:${invoice.issue_date ?? ""}`,
    `ECHEANCE:${invoice.due_date ?? ""}`,
    `MONTANT:${Math.round(totalHT)} ${invoice.currency}`,
    balance > 0 ? `SOLDE:${Math.round(balance)} ${invoice.currency}` : `SOLDE:REGLE`,
    `REF:${(invoice.order_id as string | null) ?? invoice.number}`,
  ].join("\n")

  const qrSvg = await QRCode.toString(qrContent, {
    type: "svg",
    margin: 1,
    width: 120,
    color: { dark: "#1e3a5f", light: "#ffffff" },
  })

  return (
    <FacturePrintPage
      number={invoice.number}
      status={invoice.status}
      currency={invoice.currency}
      issueDate={invoice.issue_date}
      dueDate={invoice.due_date ?? null}
      notes={invoice.notes ?? null}
      sourceRef={(invoice.order_id as string | null) ?? null}
      accountName={acc?.name ?? "—"}
      accountCity={acc?.city ?? null}
      accountCountry={acc?.country ?? null}
      accountPhone={acc?.phone ?? null}
      lines={lines}
      payments={paymentList}
      bankAccounts={(bankAccounts ?? []).map(b => ({
        name: b.name,
        institution: b.institution ?? "",
        account_number: b.account_number ?? "",
        currency: b.currency,
      }))}
      qrSvg={qrSvg}
      locale={locale}
      docSettings={docSettings ?? null}
    />
  )
}
