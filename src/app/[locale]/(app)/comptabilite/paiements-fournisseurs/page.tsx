import { createCompanyClient, getCompanySchema } from "@/lib/company"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import PaiementsFournisseursClient from "./PaiementsFournisseursClient"

export default async function PaiementsFournisseursPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db } = await createCompanyClient()

  const schema = await getCompanySchema()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminRaw = serviceKey
    ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
    : null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = adminRaw ? (adminRaw as any).schema(schema) as typeof adminRaw : db

  const [{ data: payments }, { data: treasuryAccounts }] = await Promise.all([
    db.from("supplier_payments").select(`
      id, amount, currency, method, reference, paid_at, treasury_account_id,
      invoice:supplier_invoices(id, number, status, supplier_name)
    `).order("paid_at", { ascending: false }).limit(500),
    adminDb.from("treasury_accounts").select("id, name, type").eq("is_active", true),
  ])

  const accountMap = new Map((treasuryAccounts ?? []).map((a: { id: string; name: string; type: string }) => [a.id, a]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (payments ?? []).map((p: any, idx: number) => {
    const invoice = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice
    const treasury = p.treasury_account_id ? accountMap.get(p.treasury_account_id) : null

    const year = p.paid_at ? new Date(p.paid_at).getFullYear() : new Date().getFullYear()
    const seq = String(idx + 1).padStart(5, "0")
    const prefix = treasury
      ? (treasury.name as string).replace(/\s+/g, "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 6)
      : "PAYSUP"
    const displayNumber = p.reference || `${prefix}/${year}/${seq}`

    return {
      id:             p.id as string,
      number:         displayNumber as string,
      amount:         Number(p.amount),
      currency:       (["GNF", "USD", "EUR"].includes(String(p.currency)) ? p.currency : "GNF") as "GNF" | "USD" | "EUR",
      method:         String(p.method ?? "bank"),
      paid_at:        String(p.paid_at ?? ""),
      invoice_number: invoice?.number ?? null as string | null,
      invoice_id:     invoice?.id     ?? null as string | null,
      invoice_status: invoice?.status ?? null as string | null,
      supplier_name:  invoice?.supplier_name ?? null as string | null,
      journal_name:   treasury?.name ?? null as string | null,
      journal_type:   treasury?.type ?? null as string | null,
    }
  })

  return <PaiementsFournisseursClient payments={rows} locale={locale} />
}
