import { createCompanyClient } from "@/lib/company"
import { getTranslations } from "next-intl/server"
import { Building2, TrendingUp, CalendarCheck, Receipt, Landmark, Package } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { DealStage } from "@/types"

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

  const [
    { count: accountsCount },
    { data: deals },
    { count: activitiesCount },
    { data: upcomingActivities },
    { data: invoiceStats },
    { data: treasuryStats },
    { data: stockStats },
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{td("title")}</h1>

      {/* KPI ERP */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {erpStats.map(({ label, value, sub, Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 font-medium">{label}</p>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* KPI CRM */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {crmStats.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 font-medium">{label}</p>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

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
