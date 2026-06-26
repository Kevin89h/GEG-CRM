import { createCompanyClient } from "@/lib/company"
import Link from "next/link"
import { Receipt, AlertCircle, Clock, CheckCircle2, XCircle, CircleDollarSign, Search } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"
import FacturesSearch from "./FacturesSearch"

function relativeDueDate(dueDateStr: string): { label: string; cls: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)

  if (diffDays === 0) return { label: "Aujourd'hui", cls: "text-orange-600 font-semibold" }
  if (diffDays === 1) return { label: "Demain", cls: "text-amber-600" }
  if (diffDays === -1) return { label: "Hier", cls: "text-red-600 font-semibold" }
  if (diffDays > 1 && diffDays <= 30) return { label: `Dans ${diffDays} jours`, cls: "text-gray-500" }
  if (diffDays > 30) {
    const months = Math.round(diffDays / 30)
    return { label: months === 1 ? "Le mois prochain" : `Dans ${months} mois`, cls: "text-gray-500" }
  }
  if (diffDays < -1 && diffDays >= -30) return { label: `Il y a ${-diffDays} jours`, cls: "text-red-600 font-semibold" }
  const months = Math.round(-diffDays / 30)
  return { label: months === 1 ? "Le mois dernier" : `Il y a ${months} mois`, cls: "text-red-600 font-semibold" }
}

function fmtMulti(byCur: Record<string, number>) {
  return Object.entries(byCur)
    .filter(([, v]) => v > 0)
    .map(([cur, val]) => formatCurrency(val, cur as "GNF" | "USD" | "EUR"))
    .join(" · ") || "0"
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: "Brouillon",          color: "bg-gray-100 text-gray-600",     icon: Clock },
  sent:      { label: "Comptabilisé",       color: "bg-blue-100 text-blue-700",     icon: CheckCircle2 },
  partial:   { label: "Partiellement réglé", color: "bg-amber-100 text-amber-700", icon: CircleDollarSign },
  paid:      { label: "Payée",             color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  cancelled: { label: "Annulée",           color: "bg-red-100 text-red-600",       icon: XCircle },
}

export default async function FacturesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ filtre?: string; q?: string }>
}) {
  const [{ locale }, { filtre = "ouvertes", q = "" }] = await Promise.all([params, searchParams])
  const { db: supabase } = await createCompanyClient()

  const { data: invoices } = await supabase
    .from("invoice_totals")
    .select("id, number, status, currency, account_id, issue_date, due_date, total_ht, total_paid, balance")
    .order("issue_date", { ascending: false })

  const { data: accounts } = await supabase.from("accounts").select("id, name")
  const accountMap: Record<string, string> = {}
  for (const a of accounts ?? []) accountMap[a.id] = a.name

  const allList = invoices ?? []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const ouvertesStatuses = ["sent", "partial"]
  const byFilter = filtre === "ouvertes"
    ? allList.filter(i => ouvertesStatuses.includes(i.status as string))
    : filtre === "payees"
      ? allList.filter(i => i.status === "paid")
      : filtre === "brouillons"
        ? allList.filter(i => i.status === "draft")
        : allList

  const qLower = q.toLowerCase().trim()
  const list = qLower
    ? byFilter.filter(i => {
        const num = (i.number as string ?? "").toLowerCase()
        const client = (accountMap[i.account_id as string] ?? "").toLowerCase()
        return num.includes(qLower) || client.includes(qLower)
      })
    : byFilter

  // Stats globales (sur factures ouvertes: sent, partial)
  const unpaidByCur: Record<string, number> = {}
  for (const i of allList) {
    if (ouvertesStatuses.includes(i.status as string) && Number(i.balance) > 0) {
      const cur = i.currency as string
      unpaidByCur[cur] = (unpaidByCur[cur] ?? 0) + Number(i.balance)
    }
  }
  const overdueCount = allList.filter(i =>
    ouvertesStatuses.includes(i.status as string) && i.due_date && new Date(i.due_date as string) < today
  ).length

  const filters = [
    { key: "ouvertes",   label: "Ouvertes",    count: allList.filter(i => ouvertesStatuses.includes(i.status as string)).length },
    { key: "payees",     label: "Payées",      count: allList.filter(i => i.status === "paid").length },
    { key: "brouillons", label: "Brouillons",  count: allList.filter(i => i.status === "draft").length },
    { key: "tout",       label: "Tout",        count: allList.length },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factures clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{list.length} facture{list.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-xs text-red-700 font-semibold">{overdueCount} en retard</p>
              </div>
            </div>
          )}
          {Object.keys(unpaidByCur).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-right">
              <p className="text-xs text-amber-600 font-medium">À encaisser</p>
              <p className="text-sm font-bold text-amber-700">{fmtMulti(unpaidByCur)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Filtres + Recherche */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
        {filters.map(f => (
          <Link
            key={f.key}
            href={`/${locale}/ventes/factures?filtre=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
              filtre === f.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {f.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              filtre === f.key ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"
            }`}>{f.count}</span>
          </Link>
        ))}
        </div>
        <FacturesSearch filtre={filtre} initialQ={q} locale={locale} />
      </div>

      {list.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucune facture{filtre === "ouvertes" ? " ouverte" : filtre === "payees" ? " payée" : filtre === "brouillons" ? " en brouillon" : ""}</p>
          {filtre === "tout" && <p className="text-xs mt-1">Les factures sont créées depuis un devis confirmé</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Numéro</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date de facture</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date d'échéance</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Hors taxes</th>
                {filtre !== "brouillons" && <th className="text-right px-4 py-3 font-medium text-gray-500">Encaissé</th>}
                {filtre !== "brouillons" && <th className="text-right px-4 py-3 font-medium text-gray-500">Montant dû</th>}
                <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map((i: Record<string, unknown>) => {
                const cur = i.currency as "GNF" | "USD" | "EUR"
                const balance = Number(i.balance)
                const status = i.status as string
                const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
                const Icon = cfg.icon
                const isOpen = ouvertesStatuses.includes(status)
                const dueInfo = i.due_date && isOpen ? relativeDueDate(i.due_date as string) : null
                const isOverdue = dueInfo && (dueInfo.cls.includes("red"))

                return (
                  <tr key={i.id as string} className={`hover:bg-blue-50/20 transition-colors ${isOverdue ? "bg-red-50/20" : ""}`}>
                    <td className="px-4 py-3">
                      <Link href={`/${locale}/ventes/factures/${i.id}`} className="font-mono font-semibold text-blue-600 hover:underline text-xs">
                        {i.number as string}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {accountMap[i.account_id as string] ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {i.issue_date ? formatDate(i.issue_date as string, locale) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {dueInfo
                        ? <span className={dueInfo.cls}>{dueInfo.label}</span>
                        : i.due_date
                          ? <span className="text-gray-400">{formatDate(i.due_date as string, locale)}</span>
                          : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 text-xs font-medium">
                      {formatCurrency(Number(i.total_ht), cur)}
                    </td>
                    {filtre !== "brouillons" && (
                      <td className="px-4 py-3 text-right text-emerald-700 text-xs">
                        {Number(i.total_paid) > 0 ? formatCurrency(Number(i.total_paid), cur) : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {filtre !== "brouillons" && (
                      <td className="px-4 py-3 text-right text-xs">
                        {balance > 0
                          ? <span className="font-bold text-red-600">{formatCurrency(balance, cur)}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {filtre !== "tout" && filtre !== "brouillons" && Object.keys(unpaidByCur).length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={6} className="px-4 py-3 text-xs text-gray-500 font-semibold">
                    Total montant dû ({list.filter(i => Number(i.balance) > 0).length} facture{list.filter(i => Number(i.balance) > 0).length !== 1 ? "s" : ""})
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-red-600">
                    {fmtMulti(
                      list.reduce<Record<string, number>>((acc, i) => {
                        const b = Number(i.balance)
                        if (b > 0) { const c = i.currency as string; acc[c] = (acc[c] ?? 0) + b }
                        return acc
                      }, {})
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
