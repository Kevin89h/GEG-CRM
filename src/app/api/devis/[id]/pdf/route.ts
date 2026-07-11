import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient, getCompanySchema } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { renderDevisPdf } from "./renderDevisPdf"

export const maxDuration = 60
export const runtime = "nodejs"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const isBL = req.nextUrl.searchParams.get("type") === "bon-livraison"

  const { db } = await createCompanyClient()
  const publicSupa = await createClient()
  const schema = await getCompanySchema()

  const { data: company } = await publicSupa.from("companies").select("id").eq("schema_name", schema).single()
  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const { data: order } = await db
    .from("sales_orders")
    .select("id, number, status, currency, valid_until, notes, additional_info, created_at, account_id, salesperson_id, tva, payment_terms")
    .eq("id", id)
    .single()

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [{ data: account }, { data: salesperson }, { data: rawLines }, { data: bankAccounts }] = await Promise.all([
    order.account_id ? db.from("accounts").select("id, name, country").eq("id", order.account_id).single() : Promise.resolve({ data: null }),
    order.salesperson_id ? db.from("employees").select("full_name").eq("id", order.salesperson_id).single() : Promise.resolve({ data: null }),
    db.from("sales_order_lines").select("id, description, quantity, unit_price, discount, position, product_id, tva_exempt").eq("order_id", id).order("position"),
    db.from("treasury_accounts").select("institution, account_number, swift, iban, currency").eq("type", "bank").eq("is_active", true).order("name"),
  ])

  const orderTva = Boolean((order as Record<string, unknown>).tva)
  const lines = ((rawLines ?? []) as Record<string, unknown>[]).map(l => ({
    id: String(l.id ?? ""),
    description: String(l.description ?? ""),
    quantity: Number(l.quantity) || 0,
    unit_price: Number(l.unit_price) || 0,
    discount: Number(l.discount) || 0,
    tva_rate: orderTva && !l.tva_exempt ? 18 : 0,
  }))

  const status = (order as Record<string, unknown>).status as string ?? "draft"
  const docLabel = isBL ? "BL" : status === "confirmed" ? "BC" : "DEVIS"
  const filename = `${docLabel} - ${order.number}.pdf`

  const pdfBytes = await renderDevisPdf({
    number: order.number,
    status,
    currency: order.currency,
    createdAt: order.created_at,
    validUntil: (order as Record<string, unknown>).valid_until as string | null ?? null,
    notes: (order as Record<string, unknown>).notes as string | null ?? null,
    additionalInfo: (order as Record<string, unknown>).additional_info as string | null ?? null,
    paymentTerms: (order as Record<string, unknown>).payment_terms as string | null ?? null,
    accountName: (account as Record<string, string> | null)?.name ?? "—",
    accountCountry: (account as Record<string, string> | null)?.country ?? null,
    salespersonName: (salesperson as Record<string, string> | null)?.full_name ?? null,
    lines,
    bankAccounts: (bankAccounts ?? []).map((a: Record<string, unknown>) => ({
      institution: String(a.institution ?? ""),
      account_number: String(a.account_number ?? ""),
      swift: a.swift ? String(a.swift) : null,
      iban: a.iban ? String(a.iban) : null,
      currency: String(a.currency ?? ""),
    })),
    docSettings: docSettings as Record<string, unknown> | null,
    docType: isBL ? "bon-livraison" : undefined,
  })

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
