import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import { notFound } from "next/navigation"
import BonLivraisonClient from "./BonLivraisonClient"

export default async function BonLivraisonPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db: supabase } = await createCompanyClient()
  const publicSupa = await createClient()
  const schema = await getCompanySchema()
  const { data: company } = await publicSupa.from("companies").select("id").eq("schema_name", schema).single()
  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const [{ data: dn }, { data: lines }, { data: warehouses }] = await Promise.all([
    supabase
      .from("delivery_notes")
      .select("id, number, status, invoice_id, account_id, delivery_date, notes, created_at")
      .eq("id", id)
      .single(),
    supabase
      .from("delivery_note_lines")
      .select("id, product_id, description, quantity, warehouse_id, position, line_type, print_on_delivery, invoice_line_id, product:products(name, product_type, product_code, brand, packaging, packaging_other, unit:units(name))")
      .eq("delivery_note_id", id)
      .order("position"),
    supabase
      .from("warehouses")
      .select("id, name, city, kind")
      .eq("is_active", true)
      .order("name"),
  ])
  // active catalogue sheets, to link a line that has none (regression 17/11/2026) — only useful on a draft
  const { data: catalogue } = dn?.status === "draft"
    ? await supabase.from("products").select("id, name, reference, product_type").eq("is_active", true).order("name")
    : { data: [] }

  if (!dn) notFound()

  // A2: stock of each product per warehouse (quantities only), shown next to the warehouse choice — never printed
  const productIds = [...new Set((lines ?? []).map(l => l.product_id).filter(Boolean))] as string[]
  const { data: levels } = productIds.length
    ? await supabase.from("stock_levels").select("product_id, warehouse_id, quantity").in("product_id", productIds)
    : { data: [] }
  // A1: what remains to deliver on each invoice line; M3: what was received directly for it and not yet delivered
  const invLineIds = [...new Set((lines ?? []).map(l => (l as { invoice_line_id?: string | null }).invoice_line_id).filter(Boolean))] as string[]
  const directIds = ((warehouses ?? []) as { id: string; kind?: string }[]).filter(w => w.kind === "direct").map(w => w.id)
  const [{ data: remainingRows }, { data: directIn }, { data: directOut }] = invLineIds.length
    ? await Promise.all([
        supabase.from("invoice_line_delivery").select("invoice_line_id, quantity, delivered, remaining").in("invoice_line_id", invLineIds),
        supabase.from("purchase_reception_lines").select("invoice_line_id, quantity").in("invoice_line_id", invLineIds).in("warehouse_id", directIds.length ? directIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("delivery_note_lines").select("invoice_line_id, quantity, delivery_note:delivery_notes!inner(status)").in("invoice_line_id", invLineIds).in("warehouse_id", directIds.length ? directIds : ["00000000-0000-0000-0000-000000000000"]).eq("delivery_note.status", "delivered"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]
  const remaining: Record<string, { invoiced: number; delivered: number; remaining: number; direct: number }> = {}
  for (const r of (remainingRows ?? []) as { invoice_line_id: string; quantity: number; delivered: number; remaining: number }[]) {
    remaining[r.invoice_line_id] = { invoiced: Number(r.quantity), delivered: Number(r.delivered), remaining: Number(r.remaining), direct: 0 }
  }
  for (const r of (directIn ?? []) as { invoice_line_id: string; quantity: number }[]) if (remaining[r.invoice_line_id]) remaining[r.invoice_line_id].direct += Number(r.quantity)
  for (const r of (directOut ?? []) as { invoice_line_id: string; quantity: number }[]) if (remaining[r.invoice_line_id]) remaining[r.invoice_line_id].direct -= Number(r.quantity)

  // Récupérer le client depuis la facture liée si pas de account_id direct
  let accountName: string | null = null
  if (dn.account_id) {
    const { data: acc } = await supabase.from("accounts").select("name").eq("id", dn.account_id).single()
    accountName = acc?.name ?? null
  } else if (dn.invoice_id) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("account_id")
      .eq("id", dn.invoice_id)
      .single()
    if (inv?.account_id) {
      const { data: acc } = await supabase.from("accounts").select("name").eq("id", inv.account_id).single()
      accountName = acc?.name ?? null
    }
  }

  return (
    <BonLivraisonClient
      dn={{
        id: dn.id,
        number: dn.number,
        status: dn.status,
        invoice_id: dn.invoice_id,
        delivery_date: dn.delivery_date,
        notes: dn.notes,
        created_at: dn.created_at,
        account_name: accountName,
      }}
      lines={(lines ?? []).map(l => ({
        id: l.id,
        product_id: l.product_id,
        description: l.description,
        quantity: Number(l.quantity),
        warehouse_id: l.warehouse_id,
        position: l.position,
        line_type: l.line_type ?? "product",
        print_on_delivery: l.print_on_delivery ?? false,
        invoice_line_id: (l as { invoice_line_id?: string | null }).invoice_line_id ?? null,
        ...productInfo((l as { product?: unknown }).product),
      }))}
      stock={((levels ?? []) as { product_id: string; warehouse_id: string; quantity: number }[]).map(x => ({ ...x, quantity: Number(x.quantity) }))}
      remaining={remaining}
      products={(catalogue ?? []) as { id: string; name: string; reference: string | null; product_type: string | null }[]}
      warehouses={(warehouses ?? []) as { id: string; name: string; city: string | null; kind: string }[]}
      locale={locale}
      docSettings={docSettings ?? {}}
    />
  )
}

/** Catalogue details shown on the delivery-note screen (A2): PRD code, brand, packaging, unit — never the stock value */
function productInfo(raw: unknown) {
  const p = (Array.isArray(raw) ? raw[0] : raw) as { product_type?: string | null; product_code?: string | null; brand?: string | null; packaging?: string | null; packaging_other?: string | null; unit?: unknown } | null
  const unit = (Array.isArray(p?.unit) ? p?.unit[0] : p?.unit) as { name?: string } | null | undefined
  return {
    product_type: p?.product_type ?? null,
    product_code: p?.product_code ?? null,
    brand: p?.brand ?? null,
    packaging: p?.packaging === "Autre" ? p?.packaging_other ?? "Autre" : p?.packaging ?? null,
    unit: unit?.name ?? null,
  }
}
