import { createCompanyClient } from "@/lib/company"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import PaiementsClient from "./PaiementsClient"

export default async function PaiementsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db } = await createCompanyClient()

  const cookieStore = await cookies()
  const schema = cookieStore.get("geg_company")?.value ?? "geg_guinee"
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminRaw = serviceKey
    ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
    : null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = adminRaw ? (adminRaw as any).schema(schema) as typeof adminRaw : db

  const [{ data: payments }, { data: treasuryAccounts }] = await Promise.all([
    db.from("payments").select(`
      id, amount, currency, method, reference, paid_at, treasury_account_id,
      invoice:invoices(id, number, status, account:accounts(id, name))
    `).order("paid_at", { ascending: false }).limit(500),
    adminDb.from("treasury_accounts").select("id, name, type").eq("is_active", true),
  ])

  const accountMap = new Map((treasuryAccounts ?? []).map((a: { id: string; name: string; type: string }) => [a.id, a]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (payments ?? []).map((p: any, idx: number) => {
    const invoice = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice
    const account = Array.isArray(invoice?.account) ? invoice?.account[0] : invoice?.account
    const treasury = p.treasury_account_id ? accountMap.get(p.treasury_account_id) : null

    const year = p.paid_at ? new Date(p.paid_at).getFullYear() : new Date().getFullYear()
    const seq = String(idx + 1).padStart(5, "0")
    const prefix = treasury
      ? (treasury.name as string).replace(/\s+/g, "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 6)
      : "PMT"
    const displayNumber = p.reference || `${prefix}/${year}/${seq}`

    return {
      id: p.id as string,
      number: displayNumber as string,
      amount: Number(p.amount),
      currency: String(p.currency ?? "GNF"),
      method: String(p.method ?? "Manuel"),
      paid_at: String(p.paid_at ?? ""),
      invoice_number: invoice?.number ?? null as string | null,
      invoice_id: invoice?.id ?? null as string | null,
      invoice_status: invoice?.status ?? null as string | null,
      client_name: account?.name ?? null as string | null,
      journal_name: treasury?.name ?? null as string | null,
      journal_type: treasury?.type ?? null as string | null,
    }
  })

  return <PaiementsClient payments={rows} locale={locale} />
}
