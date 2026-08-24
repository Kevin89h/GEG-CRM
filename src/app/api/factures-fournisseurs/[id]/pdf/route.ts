import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient, getCompanySchema } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { renderFactureFournisseurPdf } from "./renderFactureFournisseurPdf"

export const maxDuration = 60
export const runtime = "nodejs"

export async function GET(
  _req: NextRequest, { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { db } = await createCompanyClient()
  const publicSupa = await createClient()
  const schema = await getCompanySchema()

  const { data: company } = await publicSupa.from("companies").select("id").eq("schema_name", schema).single()
  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const { data: invoice } = await db
    .from("supplier_invoices")
    .select("id, number, status, currency, invoice_date, due_date, reference, notes, supplier_name, total_ht, tax_amount, total_ttc")
    .eq("id", id)
    .single()

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [{ data: lines }, { data: payments }] = await Promise.all([
    db.from("supplier_invoice_lines")
      .select("id, description, quantity, unit_price, tax_rate")
      .eq("invoice_id", id)
      .order("position"),
    db.from("supplier_payments")
      .select("amount, currency, paid_at")
      .eq("supplier_invoice_id", id)
      .order("paid_at"),
  ])

  const inv = invoice as Record<string, unknown>
  const totalPaid = (payments ?? []).reduce((s, p) => {
    const p_ = p as Record<string, unknown>
    return s + (Number(p_.amount) || 0)
  }, 0)
  const balance = Math.max(0, (Number(inv.total_ttc) || 0) - totalPaid)

  const pdfBytes = await renderFactureFournisseurPdf({
    number: String(inv.number ?? ""),
    status: String(inv.status ?? "pending"),
    currency: String(inv.currency ?? "GNF"),
    supplierName: String(inv.supplier_name ?? "—"),
    invoiceDate: String(inv.invoice_date ?? ""),
    dueDate: inv.due_date ? String(inv.due_date) : null,
    reference: inv.reference ? String(inv.reference) : null,
    notes: inv.notes ? String(inv.notes) : null,
    lines: (lines ?? []).map((l: Record<string, unknown>) => ({
      id: String(l.id ?? ""),
      description: String(l.description ?? ""),
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unit_price) || 0,
      tax_rate: Number(l.tax_rate) || 0,
    })),
    payments: (payments ?? []).map((p: Record<string, unknown>) => ({
      amount: Number(p.amount) || 0,
      currency: String(p.currency ?? inv.currency),
      paid_at: String(p.paid_at ?? ""),
    })),
    totalHt: Number(inv.total_ht) || 0,
    taxAmount: Number(inv.tax_amount) || 0,
    totalTtc: Number(inv.total_ttc) || 0,
    totalPaid,
    balance,
    docSettings: docSettings as Record<string, unknown> | null,
  })

  const filename = `Facture-fournisseur-${inv.number}.pdf`

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
