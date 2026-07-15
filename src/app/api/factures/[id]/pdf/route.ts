import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient, getCompanySchema } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import QRCode from "qrcode"
import { renderFacturePdf } from "./renderFacturePdf"

export const maxDuration = 60
export const runtime = "nodejs"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const showImages = req.nextUrl.searchParams.get("images") !== "0"

  const { db } = await createCompanyClient()
  const publicSupa = await createClient()
  const schema = await getCompanySchema()

  const { data: company } = await publicSupa.from("companies").select("id").eq("schema_name", schema).single()
  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const { data: invoice } = await db
    .from("invoices")
    .select(`
      id, number, status, currency, issue_date, due_date, notes, order_id,
      account:accounts(id, name, city, country, phone),
      lines:invoice_lines(id, description, quantity, unit_price, discount, position, tva_rate, product_id)
    `)
    .eq("id", id)
    .single()

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [{ data: payments }, { data: bankAccounts }] = await Promise.all([
    db.from("payments").select("amount, paid_at").eq("invoice_id", id).order("paid_at"),
    db.from("treasury_accounts").select("institution, account_number, swift, iban, currency").eq("type", "bank").eq("is_active", true).order("name"),
  ])

  const account = Array.isArray(invoice.account) ? invoice.account[0] : invoice.account
  const acc = account as Record<string, string | null> | null

  const rawLines = ((invoice.lines ?? []) as Record<string, unknown>[]).sort((a, b) => (a.position as number) - (b.position as number))
  const productIds = rawLines.map(l => l.product_id as string).filter(Boolean)
  const productImageMap: Record<string, string> = {}
  if (showImages && productIds.length > 0) {
    const { data: prods } = await db.from("products").select("id, image_url").in("id", productIds)
    for (const p of prods ?? []) {
      if ((p as Record<string, unknown>).image_url) {
        productImageMap[(p as Record<string, unknown>).id as string] = (p as Record<string, unknown>).image_url as string
      }
    }
  }

  const lines = rawLines.map(l => ({
    id: String(l.id ?? ""),
    description: String(l.description ?? ""),
    quantity: Number(l.quantity) || 0,
    unit_price: Number(l.unit_price) || 0,
    discount: Number(l.discount) || 0,
    tva_rate: l.tva_rate != null ? Number(l.tva_rate) : null,
    image_url: showImages && l.product_id ? (productImageMap[l.product_id as string] ?? null) : null,
  }))

  const paymentList = (payments ?? []).map(p => ({
    amount: Number(p.amount) || 0,
    paid_at: String(p.paid_at ?? ""),
  }))

  const totalHT = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100), 0)
  const totalPaid = paymentList.reduce((s, p) => s + p.amount, 0)
  const balance = totalHT - totalPaid

  const qrContent = [
    `FACTURE:${invoice.number}`,
    `CLIENT:${acc?.name ?? ""}`,
    `DATE:${invoice.issue_date ?? ""}`,
    `ECHEANCE:${invoice.due_date ?? ""}`,
    `MONTANT:${Math.round(totalHT)} ${invoice.currency}`,
    balance > 0 ? `SOLDE:${Math.round(balance)} ${invoice.currency}` : `SOLDE:REGLE`,
  ].join("\n")

  const qrDataUrl = await QRCode.toDataURL(qrContent, {
    margin: 1,
    width: 120,
    color: { dark: "#1e3a5f", light: "#ffffff" },
  })

  const filename = `Facture ${invoice.number}.pdf`

  const pdfBytes = await renderFacturePdf({
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency,
    issueDate: invoice.issue_date,
    dueDate: (invoice as Record<string, unknown>).due_date as string | null ?? null,
    notes: (invoice as Record<string, unknown>).notes as string | null ?? null,
    accountName: acc?.name ?? "—",
    accountCity: acc?.city ?? null,
    accountCountry: acc?.country ?? null,
    accountPhone: acc?.phone ?? null,
    lines,
    payments: paymentList,
    qrDataUrl,
    bankAccounts: (bankAccounts ?? []).map((a: Record<string, unknown>) => ({
      institution: String(a.institution ?? ""),
      account_number: String(a.account_number ?? ""),
      swift: a.swift ? String(a.swift) : null,
      iban: a.iban ? String(a.iban) : null,
      currency: String(a.currency ?? ""),
    })),
    docSettings: docSettings as Record<string, unknown> | null,
  })

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
