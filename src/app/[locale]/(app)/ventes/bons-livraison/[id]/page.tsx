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
      .select("id, product_id, description, quantity, warehouse_id, position")
      .eq("delivery_note_id", id)
      .order("position"),
    supabase
      .from("warehouses")
      .select("id, name, city")
      .eq("is_active", true)
      .order("name"),
  ])

  if (!dn) notFound()

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
      }))}
      warehouses={(warehouses ?? []) as { id: string; name: string; city: string | null }[]}
      locale={locale}
      docSettings={docSettings ?? {}}
    />
  )
}
