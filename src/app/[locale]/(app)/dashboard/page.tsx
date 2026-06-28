import { createCompanyClient } from "@/lib/company"
import { getTranslations } from "next-intl/server"
import { Building2, TrendingUp, CalendarCheck, Receipt, Landmark, Package } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { DealStage } from "@/types"
import dynamic from "next/dynamic"
const DashboardCharts = dynamic(() => import("./DashboardCharts"), { ssr: false })

const stageColors: Record<DealStage, "gray" | "blue" | "yellow" | "purple" | "green" | "red"> = {
  lead: "gray", qualified: "blue", proposal: "yellow",
  negotiation: "purple", won: "green", lost: "red",
}

function formatByCurrency(byCurrency: Record<string, number>): string {
  const entries = Object.entries(byCurrency).filter(([, v]) => v !== 0)
  if (entries.length === 0) return "0"
  return entries.map(([cur, val]) => formatCurrency(val, cur as "USD" | "GNF" | "EUR")).join(" · ")
}

export default async function DashboardPage() {
  const { db: supabase } = await createCompanyClient()
  const t = await getTranslations()
  const td = await getTranslations("dashboard")

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())

  const twelveMonthsAgo = new Date(now)
  twelveMonthsAgo.setMonth(now.getMonth() - 12)
  const eightWeeksAgo = new Date(now)
  eightWeeksAgo.setDate(now.getDate() - 56)

  const [
    { count: accountsCount },
    { data: deals },
    { count: activitiesCount },
    { data: upcomingActivities },
    { data: invoiceStats },
    { data: treasuryStats },
    { data: stockStats },
    { data: allInvoices },
    { data: recentInvoices },
    { data: recentPayments },
  ] = await Promise.all([
    supabase.from("accounts").select("*", { count: "exact", head: true }),
    supabase.from("deals")
      .select("id, title, stage, value, currency, account:accounts(name)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("activities").select("*", { count: "exact", head: true }).gte("date", weekStart.toISOString()),
    supabase.from("activities")
      .select("id, subject, follow_up_date, account:accounts(name)")
      .eq("completed", false)
      .not("follow_up_date", "is", null)
      .order("follow_up_date")
      .limit(5),
    supabase.from("invoice_totals").select("balance, currency").in("status", ["sent", "partial"]),
    supabase.from("treasury_balances").select("balance, currency").eq("is_active", true),
    supabase.from("stock_levels").select("quantity, product:products(buy_price, currency)"),
    supabase.from("invoice_totals").select("status"),
    supabase.from("invoice_totals")
      .select("total_ht, currency, issue_date")
      .neq("status", "cancelled")
      .gte("issue_date", twelveMonthsAgo.toISOString().split("T")[0]),
    supabase.from("payments")
      .select("amount, currency, paid_at")
      .gte("paid_at", eightWeeksAgo.toISOString()),
  ])

  const openDeals = (deals ?? []).filter((d: Record<string, unknown>) => !["won", "lost"].includes(d.stage as string))

  const openInvoicesByCurrency = (invoiceStats ?? []).reduce<Record<string, number>>((acc, i: Record<string, unknown>) => {
    const cur = i.currency as string
    acc[cur] = (acc[cur] ?? 0) + Number(i.balance)
    return acc
  }, {})

  const treasuryByCurrency = (treasuryStats ?? []).reduce<Record<string, number>>((acc, a: Record<string, unknown>) => {
    const cur = a.currency as string
    acc[cur] = (acc[cur] ?? 0) + Number(a.balance)
    return acc
  }, {})

  const stockValueGNF = (stockStats ?? []).reduce((sum, s: Record<string, unknown>) => {
    const product = (Array.isArray(s.product) ? s.product[0] : s.product) as { buy_price: number | null } | null
    if (!product?.buy_price) return sum
    return sum + Number(s.quantity) * product.buy_price
  }, 0)

  // ── Facturation / Paiements par mois (12 derniers mois) ──────────────────
  const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]

  const monthlyBuckets = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, invoiced: 0, paid: 0 }
  })
  const monthMap: Record<string, (typeof monthlyBuckets)[0]> = {}
  for (const b of monthlyBuckets) monthMap[b.key] = b

  for (const inv of (recentInvoices ?? []) as Array<{ total_ht: number; currency: string; issue_date: string }>) {
    if (!inv.issue_date) continue
    const key = inv.issue_date.slice(0, 7)
    if (monthMap[key]) monthMap[key].invoiced += inv.total_ht ?? 0
  }
  for (const p of (recentPayments ?? []) as Array<{ amount: number; currency: string; paid_at: string }>) {
    if (!p.paid_at) continue
    const key = p.paid_at.slice(0, 7)
    if (monthMap[key]) monthMap[key].paid += p.amount ?? 0
  }

  // ── Facturation / Paiements par semaine (8 dernières semaines) ───────────
  // Monday of each week
  const weeklyBuckets = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now)
    const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1 // 0=Mon
    d.setDate(d.getDate() - dayOfWeek - (7 - i) * 7 + 7)
    d.setHours(0, 0, 0, 0)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = MONTHS_FR[d.getMonth()]
    return { mondayMs: d.getTime(), label: `${dd} ${mm}`, invoiced: 0, paid: 0 }
  })

  for (const inv of (recentInvoices ?? []) as Array<{ total_ht: number; issue_date: string }>) {
    if (!inv.issue_date) continue
    const d = new Date(inv.issue_date)
    for (let i = weeklyBuckets.length - 1; i >= 0; i--) {
      const bucket = weeklyBuckets[i]
      const nextMs = i < weeklyBuckets.length - 1 ? weeklyBuckets[i + 1].mondayMs : Infinity
      if (d.getTime() >= bucket.mondayMs && d.getTime() < nextMs) {
        bucket.invoiced += inv.total_ht ?? 0
        break
      }
    }
  }
  for (const p of (recentPayments ?? []) as Array<{ amount: number; paid_at: string }>) {
    if (!p.paid_at) continue
    const d = new Date(p.paid_at)
    for (let i = weeklyBuckets.length - 1; i >= 0; i--) {
      const bucket = weeklyBuckets[i]
      const nextMs = i < weeklyBuckets.length - 1 ? weeklyBuckets[i + 1].mondayMs : Infinity
      if (d.getTime() >= bucket.mondayMs && d.getTime() < nextMs) {
        bucket.paid += p.amount ?? 0
        break
      }
    }
  }

  const billingData = {
    monthly: monthlyBuckets.map(({ label, invoiced, paid }) => ({ label, invoiced, paid })),
    weekly: weeklyBuckets.map(({ label, invoiced, paid }) => ({ label, invoiced, paid })),
  }

  // Pipeline chart data
  const STAGE_META: Record<string, { label: string; color: string; order: number }> = {
    lead:        { label: "Lead",         color: "#94a3b8", order: 0 },
    qualified:   { label: "Qualifié",     color: "#60a5fa", order: 1 },
    proposal:    { label: "Proposition",  color: "#fbbf24", order: 2 },
    negotiation: { label: "Négociation",  color: "#a78bfa", order: 3 },
    won:         { label: "Gagné",        color: "#34d399", order: 4 },
  }
  const pipelineByStage: Record<string, { value: number; count: number }> = {}
  for (const d of (deals ?? []) as Array<{ stage: string; value: number | null; currency: string }>) {
    if (d.stage === "lost") continue
    if (!pipelineByStage[d.stage]) pipelineByStage[d.stage] = { value: 0, count: 0 }
    pipelineByStage[d.stage].value += d.value ?? 0
    pipelineByStage[d.stage].count += 1
  }
  const pipeline = Object.entries(STAGE_META)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([stage, meta]) => ({
      stage,
      label: meta.label,
      color: meta.color,
      value: pipelineByStage[stage]?.value ?? 0,
      count: pipelineByStage[stage]?.count ?? 0,
    }))

  // Invoice status chart data
  const STATUS_META: Record<string, { label: string; color: string }> = {
    draft:     { label: "Brouillon",   color: "#94a3b8" },
    sent:      { label: "Envoyée",     color: "#fbbf24" },
    partial:   { label: "Partiel",     color: "#60a5fa" },
    paid:      { label: "Payée",       color: "#34d399" },
    cancelled: { label: "Annulée",     color: "#f87171" },
  }
  const invoiceByStatus: Record<string, number> = {}
  for (const inv of (allInvoices ?? []) as Array<{ status: string }>) {
    invoiceByStatus[inv.status] = (invoiceByStatus[inv.status] ?? 0) + 1
  }
  const invoiceStatus = Object.entries(STATUS_META).map(([status, meta]) => ({
    label: meta.label,
    color: meta.color,
    value: invoiceByStatus[status] ?? 0,
  }))

  const erpStats = [
    {
      label: "Factures ouvertes",
      value: formatByCurrency(openInvoicesByCurrency),
      sub: `${invoiceStats?.length ?? 0} en attente d'encaissement`,
      Icon: Receipt, color: "text-amber-600", bg: "bg-amber-50",
    },
    {
      label: "Trésorerie totale",
      value: formatByCurrency(treasuryByCurrency),
      sub: `${treasuryStats?.length ?? 0} compte${(treasuryStats?.length ?? 0) !== 1 ? "s" : ""}`,
      Icon: Landmark, color: "text-emerald-600", bg: "bg-emerald-50",
    },
    {
      label: "Valeur stock",
      value: formatCurrency(stockValueGNF, "GNF"),
      sub: "Au prix de revient",
      Icon: Package, color: "text-blue-600", bg: "bg-blue-50",
    },
  ]

  const crmStats = [
    { label: td("totalAccounts"), value: String(accountsCount ?? 0), Icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: td("openDeals"), value: String(openDeals.length), Icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
    { label: td("activitiesThisWeek"), value: String(activitiesCount ?? 0), Icon: CalendarCheck, color: "text-amber-600", bg: "bg-amber-50" },
  ]

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">{td("title")}</h1>

      {/* KPI ERP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
        {erpStats.map(({ label, value, sub, Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <p className="text-sm text-gray-500 font-medium">{label}</p>
              <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 md:w-5 md:h-5 ${color}`} />
              </div>
            </div>
            <p className="text-base md:text-lg font-bold text-gray-900 leading-tight">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* KPI CRM */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        {crmStats.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <p className="text-xs md:text-sm text-gray-500 font-medium leading-tight">{label}</p>
              <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 md:w-5 md:h-5 ${color}`} />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <DashboardCharts pipeline={pipeline} invoiceStatus={invoiceStatus} billingData={billingData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">{td("recentDeals")}</h2>
          </div>
          {(deals ?? []).length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">{td("noDeals")}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {(deals ?? []).map((d: Record<string, unknown>) => (
                <div key={d.id as string} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.title as string}</p>
                    <p className="text-xs text-gray-500 truncate">{(d.account as { name: string } | null)?.name ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {d.value != null && (
                      <span className="text-sm font-semibold text-gray-800">
                        {formatCurrency(d.value as number, d.currency as "USD" | "GNF" | "EUR")}
                      </span>
                    )}
                    <Badge variant={stageColors[d.stage as DealStage]}>{t(`deals.${d.stage as string}`)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">{td("upcomingActivities")}</h2>
          </div>
          {(upcomingActivities ?? []).length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">{td("noActivities")}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {(upcomingActivities ?? []).map((a: Record<string, unknown>) => (
                <div key={a.id as string} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.subject as string}</p>
                    <span className="text-xs text-amber-600 flex-shrink-0 ml-3">
                      {formatDate(a.follow_up_date as string, "fr")}
                    </span>
                  </div>
                  {a.account != null && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(a.account as { name: string }).name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
