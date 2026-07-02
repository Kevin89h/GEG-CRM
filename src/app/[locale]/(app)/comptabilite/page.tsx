import { createCompanyClient } from "@/lib/company"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import ComptabiliteClient from "./ComptabiliteClient"

const SUPER_ADMIN_EMAIL = "kevin@globalenergy.group"

export default async function ComptabilitePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db } = await createCompanyClient()

  // Vérifier si l'utilisateur connecté est super admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", user?.id ?? "").single()
  const isSuperAdmin = profile?.email === SUPER_ADMIN_EMAIL

  // Admin client for treasury_transactions (bypasses RLS)
  const cookieStore = await cookies()
  const schema = cookieStore.get("geg_company")?.value ?? "geg_guinee"
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
    { data: treasuryAccounts },
    { data: transactions },
  ] = await Promise.all([
    // Toutes les factures clients avec leur statut et montants
    db.from("invoice_totals")
      .select("id, number, status, currency, due_date, total_ht, total_paid, balance, account_id, issue_date"),
    // Factures fournisseurs avec solde réel
    db.from("supplier_invoice_totals")
      .select("id, number, status, currency, total_ht, total_ttc, balance, invoice_date")
      .order("invoice_date", { ascending: false })
      .limit(200),
    // Comptes de trésorerie (anon key OK, RLS allows SELECT)
    db.from("treasury_balances")
      .select("*")
      .eq("is_active", true)
      .order("name"),
    // Dernières transactions (admin key needed to bypass RLS)
    adminDb.from("treasury_transactions")
      .select("id, account_id, type, amount, currency, description, reference, category, date")
      .order("date", { ascending: false })
      .limit(200),
  ])

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
  }

  // Calcul stats achats
  const allPurchases = purchases ?? []
  const purchaseStats = {
    draft:        allPurchases.filter(p => p.status === "draft"),
    toPay:        allPurchases.filter(p => p.status === "pending" || p.status === "partial"),
    draftAmount:  allPurchases.filter(p => p.status === "draft").reduce((s, p) => s + Number(p.total_ht), 0),
    toPayAmount:  allPurchases.filter(p => p.status === "pending" || p.status === "partial").reduce((s, p) => s + Number(p.balance ?? p.total_ht), 0),
  }

  const accounts = (treasuryAccounts ?? []).map(a => ({
    ...a,
    balance:         Number(a.balance),
    total_in:        Number(a.total_in),
    total_out:       Number(a.total_out),
    initial_balance: Number(a.initial_balance),
  }))

  return (
    <ComptabiliteClient
      locale={locale}
      clientStats={clientStats}
      purchaseStats={purchaseStats}
      accounts={accounts}
      transactions={transactions ?? []}
      isSuperAdmin={isSuperAdmin}
    />
  )
}
