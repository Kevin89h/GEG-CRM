import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import AchatPrintPage from "./AchatPrintPage"

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id } = await params
  const { db } = await createCompanyClient()
  const { data: order } = await db.from("purchase_orders").select("number").eq("id", id).single()
  return { title: order ? `Bon de commande ${order.number}` : "Bon de commande" }
}

export default async function AchatPdfPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
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

  const [{ data: order }, { data: landedLines }] = await Promise.all([
    db.from("purchase_orders").select("*").eq("id", id).single(),
    db.from("purchase_landed_costs").select("*").eq("order_id", id).order("position"),
  ])

  if (!order) notFound()

  const seenIds = new Set<string>()
  const lines = (landedLines ?? [])
    .filter((l: Record<string, unknown>) => {
      if (seenIds.has(l.line_id as string)) return false
      seenIds.add(l.line_id as string)
      return true
    })
    .map((l: Record<string, unknown>) => ({
      description: String(l.description ?? ""),
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.fob_unit_price) || 0,
      total: Number(l.fob_total) || 0,
    }))

  const totalHT = lines.reduce((s, l) => s + l.total, 0)

  return (
    <AchatPrintPage
      number={order.number}
      status={order.status}
      currency={order.currency}
      orderDate={order.order_date}
      expectedDate={order.expected_date ?? null}
      supplierName={order.supplier_name}
      incoterm={order.incoterm ?? null}
      notes={order.notes ?? null}
      lines={lines}
      totalHT={totalHT}
      locale={locale}
      docSettings={docSettings ?? null}
    />
  )
}
