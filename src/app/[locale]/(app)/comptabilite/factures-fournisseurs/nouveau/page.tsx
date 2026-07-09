import { createCompanyClient } from "@/lib/company"
import NouvelleFactureFournisseurClient from "./NouvelleFactureFournisseurClient"

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string>>
}

export default async function NouvelleFactureFournisseurPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const sp = await searchParams
  const { db } = await createCompanyClient()

  const { data: treasuryAccounts } = await db
    .from("treasury_accounts")
    .select("id, name, type, currency")
    .eq("is_active", true)
    .order("name")

  // Pré-remplissage depuis un bon de commande
  let prefill = null
  if (sp.order_id) {
    const [{ data: poLines }, { data: po }] = await Promise.all([
      db.from("purchase_order_lines")
        .select("description, quantity, fob_unit_price, position")
        .eq("order_id", sp.order_id)
        .order("position"),
      db.from("purchase_orders")
        .select("global_discount_pct")
        .eq("id", sp.order_id)
        .single(),
    ])

    const discountPct = Number(po?.global_discount_pct ?? 0)
    const discountFactor = 1 - discountPct / 100

    prefill = {
      order_id: sp.order_id,
      reception_id: sp.reception_id ?? null,
      supplier: sp.supplier ?? "",
      currency: sp.currency ?? "GNF",
      reference: sp.reference ?? "",
      lines: (poLines ?? []).map(l => ({
        description: l.description,
        quantity: String(l.quantity),
        unit_price: String(Math.round(Number(l.fob_unit_price) * discountFactor)),
        tax_rate: "0",
      })),
    }
  }

  return (
    <NouvelleFactureFournisseurClient
      locale={locale}
      treasuryAccounts={treasuryAccounts ?? []}
      prefill={prefill}
    />
  )
}
