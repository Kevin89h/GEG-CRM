import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import { notFound } from "next/navigation"
import AchatDetailClient from "./AchatDetailClient"

export default async function AchatDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db: supabase } = await createCompanyClient()
  const publicSupa = await createClient()
  const schema = await getCompanySchema()
  const { data: company } = await publicSupa.from("companies").select("id").eq("schema_name", schema).single()
  const { data: docSettings } = company
    ? await publicSupa.from("document_settings").select("*").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const [{ data: order }, { data: landedLines }, { data: costs }, { data: warehouses }, { data: rates }, { data: receptions }] = await Promise.all([
    supabase.from("purchase_orders").select("*").eq("id", id).single(),
    supabase.from("purchase_landed_costs").select("*").eq("order_id", id).order("position"),
    supabase.from("purchase_costs").select("*").eq("order_id", id),
    supabase.from("warehouses").select("id, name, city").eq("is_active", true).order("name"),
    supabase.from("exchange_rates").select("from_currency, to_currency, rate, effective_date").order("effective_date", { ascending: false }),
    supabase.from("purchase_receptions").select("id, number, received_at, purchase_reception_lines(id, description, quantity, unit_price, warehouse_id)").eq("order_id", id).order("created_at"),
  ])

  if (!order) notFound()

  return (
    <AchatDetailClient
      order={order}
      lines={(landedLines ?? []).map((l: Record<string, unknown>) => ({
        line_id: l.line_id as string,
        product_id: l.product_id as string | null,
        description: l.description as string,
        quantity: Number(l.quantity),
        fob_unit_price: Number(l.fob_unit_price),
        fob_total: Number(l.fob_total),
        allocated_costs: Number(l.allocated_costs),
        landed_total: Number(l.landed_total),
        landed_unit_price: Number(l.landed_unit_price),
        warehouse_id: l.warehouse_id as string | null,
      }))}
      costs={(costs ?? []) as { id: string; type: string; label: string; amount: number; currency: string }[]}
      warehouses={warehouses ?? []}
      exchangeRates={(rates ?? []) as { from_currency: string; to_currency: string; rate: number; effective_date: string }[]}
      locale={locale}
      docSettings={docSettings ?? {}}
      receptions={(receptions ?? []) as { id: string; number: string; received_at: string; purchase_reception_lines: { id: string; description: string; quantity: number; unit_price: number; warehouse_id: string | null }[] }[]}
    />
  )
}
