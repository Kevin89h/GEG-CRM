import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient, getCompanySchema } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { renderBonLivraisonPdf } from "./renderBonLivraisonPdf"

export const maxDuration = 60
export const runtime = "nodejs"

export async function GET(
  _req: NextRequest, { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { db } = await createCompanyClient()
  const publicSupa = await createClient()
  const schema = await getCompanySchema()

  const { data: company } = await publicSupa
    .from("companies")
    .select("id, name")
    .eq("schema_name", schema)
    .single()

  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", (company as Record<string, unknown>).id as string).maybeSingle()
    : { data: null }

  const { data: dn } = await db
    .from("delivery_notes")
    .select("id, number, status, delivery_date, notes, created_at, account_id, invoice_id")
    .eq("id", id)
    .single()

  if (!dn) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: lines } = await db
    .from("delivery_note_lines")
    .select("id, description, quantity, warehouse_id, position")
    .eq("delivery_note_id", id)
    .order("position")

  // Resolve account name the same way as page.tsx
  let accountName: string | null = null
  const dnr = dn as Record<string, unknown>
  if (dnr.account_id) {
    const { data: acc } = await db.from("accounts").select("name").eq("id", dnr.account_id as string).single()
    accountName = (acc as Record<string, string> | null)?.name ?? null
  } else if (dnr.invoice_id) {
    const { data: inv } = await db.from("invoices").select("account_id").eq("id", dnr.invoice_id as string).single()
    const invR = inv as Record<string, unknown> | null
    if (invR?.account_id) {
      const { data: acc } = await db.from("accounts").select("name").eq("id", invR.account_id as string).single()
      accountName = (acc as Record<string, string> | null)?.name ?? null
    }
  }

  // Resolve warehouse names
  const rawLines = ((lines ?? []) as Record<string, unknown>[])
  const warehouseIds = rawLines.map(l => l.warehouse_id as string).filter(Boolean)
  const warehouseMap: Record<string, string> = {}
  if (warehouseIds.length > 0) {
    const { data: warehouses } = await db
      .from("warehouses")
      .select("id, name, city")
      .in("id", warehouseIds)
    for (const w of (warehouses ?? []) as Record<string, string | null>[]) {
      warehouseMap[w.id as string] = w.city ? `${w.name} — ${w.city}` : (w.name ?? "")
    }
  }

  const pdfLines = rawLines.map(l => ({
    description: String(l.description ?? ""),
    quantity: Number(l.quantity) || 0,
    warehouse: l.warehouse_id ? (warehouseMap[l.warehouse_id as string] ?? null) : null,
  }))

  const filename = `BL ${dn.number}.pdf`

  const pdfBytes = await renderBonLivraisonPdf({
    number: dn.number as string,
    status: dn.status as string,
    accountName,
    createdAt: dn.created_at as string | null,
    deliveryDate: dn.delivery_date as string | null,
    notes: dn.notes as string | null,
    lines: pdfLines,
    companyName: (company as Record<string, string | null> | null)?.name ?? null,
    docSettings: docSettings as Record<string, unknown> | null,
  })

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
