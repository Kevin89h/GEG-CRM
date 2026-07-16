import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import QRCode from "qrcode"
import FacturePrintPage from "./FacturePrintPage"

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params
  const { db } = await createCompanyClient()
  const { data: invoice } = await db.from("invoices").select("number").eq("id", id).single()
  return { title: invoice ? `Facture ${invoice.number}` : "Facture" }
}

export default async function FacturePdfPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const publicSupa = await createClient()
  let { db, schema } = await createCompanyClient()

  // image_url is fetched separately so a missing column on products never breaks the invoice load.
  const INVOICE_SELECT = `
    id, number, status, currency, issue_date, due_date, notes, order_id,
    account:accounts(id, name, city, country, phone),
    lines:invoice_lines(id, description, quantity, unit_price, discount, position, tva_rate, product:products(id, name, reference))
  `

  let { data: invoice, error: invoiceError } = await db
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("id", id)
    .single()

  if (invoiceError) console.error("[PDF] Invoice query error:", invoiceError.message, invoiceError.code)

  if (!invoice && schema !== "geg_guinee") {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallbackDb = (supabase as any).schema("geg_guinee") as typeof supabase
    schema = "geg_guinee"
    const { data: fallbackInvoice, error: fallbackError } = await fallbackDb
      .from("invoices")
      .select(INVOICE_SELECT)
      .eq("id", id)
      .single()
    if (fallbackError) console.error("[PDF] Fallback invoice query error:", fallbackError.message, fallbackError.code)
    if (fallbackInvoice) {
      invoice = fallbackInvoice
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db = fallbackDb as any
    }
  }

  if (!invoice) notFound()

  const { data: company } = await publicSupa
    .from("companies")
    .select("id")
    .eq("schema_name", schema)
    .single()

  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const { data: payments } = await db.from("payments").select("amount, paid_at").eq("invoice_id", id).order("paid_at")

  const { data: bankAccounts } = await db
    .from("treasury_accounts")
    .select("institution, account_number, swift, iban, currency")
    .eq("type", "bank")
    .eq("is_active", true)
    .order("name")

  const account = Array.isArray(invoice.account) ? invoice.account[0] : invoice.account
  const acc = account as Record<string, string | null> | null

  // Fetch product images separately so a missing image_url column never breaks the PDF.
  const rawLines = ((invoice.lines ?? []) as Record<string, unknown>[])
    .sort((a, b) => (a.position as number) - (b.position as number))

  const productIds = rawLines
    .map(l => {
      const p = Array.isArray(l.product) ? l.product[0] : l.product
      return (p as Record<string, unknown> | null)?.id as string | undefined
    })
    .filter((pid): pid is string => Boolean(pid))

  const imageByProductId: Record<string, string> = {}
  if (productIds.length > 0) {
    const { data: productImages } = await db
      .from("products")
      .select("id, image_url")
      .in("id", productIds)
    for (const p of productImages ?? []) {
      if (p.image_url) imageByProductId[p.id] = p.image_url
    }
  }

  const lines = rawLines.map(l => {
    const p = Array.isArray(l.product) ? l.product[0] : l.product
    const productId = (p as Record<string, unknown> | null)?.id as string | undefined
    return {
      id: String(l.id ?? ""),
      description: String(l.description ?? ""),
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unit_price) || 0,
      discount: Number(l.discount) || 0,
      tva_rate: l.tva_rate != null ? Number(l.tva_rate) : null,
      image_url: productId ? (imageByProductId[productId] ?? null) : null,
      product: Array.isArray(l.product)
        ? (l.product[0] ?? null)
        : (l.product as { name: string; reference: string | null } | null),
    }
  })

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
      id={id}
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
      qrSvg={qrSvg}
      locale={locale}
      docSettings={docSettings ?? null}
      bankAccounts={(bankAccounts ?? []).map(a => ({ ...a, swift: (a as Record<string,unknown>).swift as string|null ?? null, iban: (a as Record<string,unknown>).iban as string|null ?? null }))}
    />
  )
}
