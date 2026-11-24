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
    supabase.from("warehouses").select("id, name, city, kind").eq("is_active", true).order("name"),
    supabase.from("exchange_rates").select("from_currency, to_currency, rate, effective_date").order("effective_date", { ascending: false }),
    supabase.from("purchase_receptions").select("id, number, received_at, purchase_reception_lines(id, description, quantity, unit_price, warehouse_id)").eq("order_id", id).order("created_at"),
  ])

  if (!order) notFound()

  // D3: quantity already received per line (the most reliable of the line counter and the reception lines);
  // T-01: product type (services are received without stock)
  const { data: polRows } = await supabase.from("purchase_order_lines").select("id, product_id, qty_received, product:products(product_type)").eq("order_id", id)
  const lineIds = ((polRows ?? []) as { id: string }[]).map(l => l.id)
  const { data: recRows } = lineIds.length ? await supabase.from("purchase_reception_lines").select("order_line_id, quantity").in("order_line_id", lineIds) : { data: [] }
  const recSum = new Map<string, number>()
  for (const r of (recRows ?? []) as { order_line_id: string; quantity: number }[]) recSum.set(r.order_line_id, (recSum.get(r.order_line_id) ?? 0) + Number(r.quantity))
  const pol = new Map(((polRows ?? []) as { id: string; product_id: string | null; qty_received: number | null; product: unknown }[]).map(l => {
    const p = (Array.isArray(l.product) ? l.product[0] : l.product) as { product_type?: string | null } | null
    return [l.id, { received: Math.max(Number(l.qty_received ?? 0), recSum.get(l.id) ?? 0), product_type: p?.product_type ?? null, product_id: l.product_id }]
  }))

  // M3: emitted customer invoice lines of the same products still to deliver (targets of a direct delivery)
  const poProducts = [...new Set([...pol.values()].map(l => l.product_id).filter(Boolean))] as string[]
  const { data: openLines } = poProducts.length
    ? await supabase.from("invoice_line_delivery").select("invoice_line_id, invoice_id, product_id, description, remaining").in("product_id", poProducts).gt("remaining", 0)
    : { data: [] }
  const invIds = [...new Set(((openLines ?? []) as { invoice_id: string }[]).map(l => l.invoice_id))]
  const { data: invs } = invIds.length
    ? await supabase.from("invoices").select("id, number, status, account:accounts(name)").in("id", invIds).in("status", ["sent", "partial", "paid"])
    : { data: [] }
  const invById = new Map(((invs ?? []) as { id: string; number: string; account: unknown }[]).map(i => [i.id, i]))
  const directTargets = ((openLines ?? []) as { invoice_line_id: string; invoice_id: string; product_id: string; description: string; remaining: number }[])
    .filter(l => invById.has(l.invoice_id))
    .map(l => {
      const inv = invById.get(l.invoice_id)!
      const acc = (Array.isArray(inv.account) ? inv.account[0] : inv.account) as { name?: string } | null
      return { invoice_line_id: l.invoice_line_id, product_id: l.product_id, label: `${inv.number}${acc?.name ? ` — ${acc.name}` : ""} — ${l.description}`, remaining: Number(l.remaining) }
    })

  return (
    <AchatDetailClient
      order={order}
      lines={Array.from(
        new Map(
          (landedLines ?? []).map((l: Record<string, unknown>) => [
            l.line_id as string,
            {
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
              qty_received: pol.get(l.line_id as string)?.received ?? 0,
              product_type: pol.get(l.line_id as string)?.product_type ?? null,
            },
          ])
        ).values()
      )}
      costs={(costs ?? []) as { id: string; type: string; label: string; amount: number; currency: string }[]}
      warehouses={warehouses ?? []}
      directTargets={directTargets}
      exchangeRates={(rates ?? []) as { from_currency: string; to_currency: string; rate: number; effective_date: string }[]}
      locale={locale}
      docSettings={docSettings ?? {}}
      receptions={(receptions ?? []) as { id: string; number: string; received_at: string; purchase_reception_lines: { id: string; description: string; quantity: number; unit_price: number; warehouse_id: string | null }[] }[]}
    />
  )
}
