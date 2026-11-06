import { createCompanyClient } from "@/lib/company"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import ComptabiliteClient from "./ComptabiliteClient"
import { isSuperAdmin as isSuperAdminRole } from "@/lib/roles"

/** Customer invoices still due (sent or partially paid) */
function allInvoicesForAgeing<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter(i => i.status === "sent" || i.status === "partial")
}

export default async function ComptabilitePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db, schema } = await createCompanyClient()

  // Vérifier si l'utilisateur connecté est super admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single()
  const isSuperAdmin = isSuperAdminRole(profile?.role)

  // Admin client for treasury_transactions (bypasses RLS)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminRaw = serviceKey
    ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
    : null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = adminRaw ? (adminRaw as any).schema(schema) as typeof adminRaw : db

  const today = new Date().toISOString().split("T")[0]

  const [
    { data: invoices },
    { data: purchases },
    { data: treasuryBalances },
    { data: transactions },
    { data: swiftIbanData },
  ] = await Promise.all([
    db.from("invoice_totals")
      .select("id, number, status, currency, due_date, total_ht, total_paid, balance, account_id, issue_date"),
    db.from("supplier_invoice_totals")
      .select("id, number, status, currency, total_ht, total_ttc, balance, invoice_date")
      .order("invoice_date", { ascending: false })
      .limit(200),
    // Soldes depuis la vue (total_in/total_out calcules)
    adminDb.from("treasury_balances")
      .select("id, name, type, institution, account_number, currency, color, is_active, initial_balance, total_in, total_out")
      .eq("is_active", true)
      .order("name"),
    adminDb.from("treasury_transactions")
      .select("id, account_id, type, amount, currency, description, reference, category, date")
      .order("date", { ascending: false })
      .limit(200),
    // swift/iban depuis la table de base (pas dans la vue)
    adminDb.from("treasury_accounts")
      .select("id, swift, iban")
      .eq("is_active", true),
  ])

  // Fusionner swift/iban dans les donnees de solde
  const swiftMap = new Map((swiftIbanData ?? []).map((a: { id: string; swift: string | null; iban: string | null }) => [a.id, a]))
  const treasuryAccounts = (treasuryBalances ?? []).map(a => ({
    ...a,
    swift: swiftMap.get(a.id)?.swift ?? null,
    iban: swiftMap.get(a.id)?.iban ?? null,
  }))

  // F6: amounts per currency, never added across currencies (no consolidated total, so no exchange rate needed)
  const byCurrency = <T extends { currency: string | null }>(rows: T[], amount: (r: T) => number) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      const cur = r.currency ?? "GNF"
      acc[cur] = (acc[cur] ?? 0) + Number(amount(r) || 0)
      return acc
    }, {})

  // Calcul stats factures clients
  const allInvoices = invoices ?? []
  const clientStats = {
    draft:   allInvoices.filter(i => i.status === "draft"),
    unpaid:  allInvoices.filter(i => i.status === "sent" || i.status === "partial"),
    overdue: allInvoices.filter(i =>
      (i.status === "sent" || i.status === "partial") &&
      i.due_date && i.due_date < today
    ),
    draftAmount:   allInvoices.filter(i => i.status === "draft").reduce((s, i) => s + Number(i.total_ht), 0),
    unpaidAmount:  allInvoices.filter(i => i.status === "sent" || i.status === "partial").reduce((s, i) => s + Number(i.balance), 0),
    overdueAmount: allInvoices.filter(i => (i.status === "sent" || i.status === "partial") && i.due_date && i.due_date < today).reduce((s, i) => s + Number(i.balance), 0),
    draftAmounts:   byCurrency(allInvoices.filter(i => i.status === "draft"), i => Number(i.total_ht)),
    unpaidAmounts:  byCurrency(allInvoices.filter(i => i.status === "sent" || i.status === "partial"), i => Number(i.balance)),
    overdueAmounts: byCurrency(allInvoices.filter(i => (i.status === "sent" || i.status === "partial") && i.due_date && i.due_date < today), i => Number(i.balance)),
  }

  // A3: real chart data (no simulated value). Heights use counts, amounts are listed per currency (never added
  // across currencies). Customer invoices: what remains due, by due date. Supplier invoices: last 6 months.
  const dayMs = 86400000
  const ageing = [
    { key: "overdue", label: "En retard" },
    { key: "d7", label: "≤ 7 jours" },
    { key: "d30", label: "8–30 jours" },
    { key: "d60", label: "31–60 jours" },
    { key: "later", label: "> 60 jours" },
    { key: "none", label: "Sans échéance" },
  ].map(b => ({ ...b, count: 0, amounts: {} as Record<string, number> }))
  for (const i of allInvoicesForAgeing(invoices ?? [])) {
    const days = i.due_date ? Math.floor((Date.parse(i.due_date) - Date.parse(today)) / dayMs) : null
    const b = days === null ? ageing[5] : days < 0 ? ageing[0] : days <= 7 ? ageing[1] : days <= 30 ? ageing[2] : days <= 60 ? ageing[3] : ageing[4]
    b.count++
    b.amounts[i.currency] = (b.amounts[i.currency] ?? 0) + Number(i.balance ?? 0)
  }
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
  const now = new Date()
  const purchaseMonths = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1)
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTHS[d.getMonth()], count: 0, amounts: {} as Record<string, number> }
  })
  const firstMonth = purchaseMonths[0].key + "-01"
  const { data: purchasesForChart } = await db.from("supplier_invoice_totals")
    .select("currency, total_ttc, invoice_date, status").gte("invoice_date", firstMonth).neq("status", "cancelled")
  for (const p of purchasesForChart ?? []) {
    const m = purchaseMonths.find(x => x.key === String(p.invoice_date ?? "").slice(0, 7))
    if (!m) continue
    m.count++
    m.amounts[p.currency ?? "GNF"] = (m.amounts[p.currency ?? "GNF"] ?? 0) + Number(p.total_ttc ?? 0)
  }

  // Calcul stats achats
  const allPurchases = purchases ?? []
  const purchaseStats = {
    draft:        allPurchases.filter(p => p.status === "draft"),
    toPay:        allPurchases.filter(p => p.status === "pending" || p.status === "partial"),
    draftAmount:  allPurchases.filter(p => p.status === "draft").reduce((s, p) => s + Number(p.total_ht), 0),
    toPayAmount:  allPurchases.filter(p => p.status === "pending" || p.status === "partial").reduce((s, p) => s + Number(p.balance ?? p.total_ht), 0),
    draftAmounts: byCurrency(allPurchases.filter(p => p.status === "draft"), p => Number(p.total_ht)),
    toPayAmounts: byCurrency(allPurchases.filter(p => p.status === "pending" || p.status === "partial"), p => Number(p.balance ?? p.total_ht)),
  }

  const accounts = (treasuryAccounts ?? []).map(a => {
    const totalIn  = Number(a.total_in)
    const totalOut = Number(a.total_out)
    const initial  = Number(a.initial_balance)
    return {
      ...a,
      balance:         initial + totalIn - totalOut,
      total_in:        totalIn,
      total_out:       totalOut,
      initial_balance: initial,
    }
  })

  return (
    <ComptabiliteClient
      locale={locale}
      clientStats={clientStats}
      purchaseStats={purchaseStats}
      invoiceAgeing={ageing.map(({ label, count, amounts }) => ({ label, count, amounts }))}
      purchaseMonths={purchaseMonths.map(({ label, count, amounts }) => ({ label, count, amounts }))}
      accounts={accounts}
      transactions={transactions ?? []}
      isSuperAdmin={isSuperAdmin}
    />
  )
}
