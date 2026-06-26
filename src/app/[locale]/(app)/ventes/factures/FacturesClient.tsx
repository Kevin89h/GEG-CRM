"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  Plus, Search, ChevronLeft, ChevronRight, LayoutList, LayoutGrid,
  Receipt, Clock,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Invoice {
  id: string
  number: string
  status: string
  currency: string
  account_id: string | null
  issue_date: string | null
  due_date: string | null
  total_ht: number
  total_paid: number
  balance: number
  client_name: string
}

interface Props {
  invoices: Invoice[]
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  draft:   { label: "Brouillon",           bg: "bg-gray-50",    text: "text-gray-600",    dot: "bg-gray-400" },
  sent:    { label: "Comptabilisé",        bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  partial: { label: "Partiellement réglé", bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400" },
  paid:    { label: "Payée",               bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelled: { label: "Annulée",           bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-400" },
}

type Tab = "ouvertes" | "payees" | "brouillons" | "tout"

function relativeDate(dateStr: string | null): { label: string; overdue: boolean } {
  if (!dateStr) return { label: "—", overdue: false }
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000)
  if (diff === 0) return { label: "Aujourd'hui", overdue: false }
  if (diff === -1) return { label: "Hier", overdue: true }
  if (diff === 1) return { label: "Demain", overdue: false }
  if (diff < 0) return { label: `Il y a ${Math.abs(diff)} j`, overdue: true }
  if (diff <= 30) return { label: `Dans ${diff} j`, overdue: false }
  return { label: formatDate(dateStr, "fr"), overdue: false }
}

function fmtMulti(byCur: Record<string, number>) {
  return Object.entries(byCur)
    .filter(([, v]) => v > 0)
    .map(([cur, val]) => formatCurrency(val, cur as "GNF" | "USD" | "EUR"))
    .join(" · ") || "—"
}

export default function FacturesClient({ invoices }: Props) {
  const params = useParams()
  const locale = params.locale as string

  const [tab, setTab] = useState<Tab>("ouvertes")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 20

  const openStatuses = ["sent", "partial"]

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    const open = invoices.filter(i => openStatuses.includes(i.status))
    const overdue = open.filter(i => i.due_date && new Date(i.due_date) < today)
    const unpaid: Record<string, number> = {}
    for (const i of open) {
      if (i.balance > 0) unpaid[i.currency] = (unpaid[i.currency] ?? 0) + i.balance
    }
    return {
      ouvertes: open.length,
      enRetard: overdue.length,
      payees: invoices.filter(i => i.status === "paid").length,
      brouillons: invoices.filter(i => i.status === "draft").length,
      total: invoices.length,
      unpaid,
      unpaidTotal: fmtMulti(unpaid),
    }
  }, [invoices])

  const displayed = useMemo(() => {
    let base: Invoice[]
    if (tab === "ouvertes") base = invoices.filter(i => openStatuses.includes(i.status))
    else if (tab === "payees") base = invoices.filter(i => i.status === "paid")
    else if (tab === "brouillons") base = invoices.filter(i => i.status === "draft")
    else base = invoices
    if (search) {
      const q = search.toLowerCase()
      base = base.filter(i =>
        i.number.toLowerCase().includes(q) ||
        i.client_name.toLowerCase().includes(q)
      )
    }
    return base
  }, [tab, search, invoices])

  const totalPages = Math.max(1, Math.ceil(displayed.length / pageSize))
  const paged = displayed.slice((page - 1) * pageSize, page * pageSize)
  function goPage(n: number) { setPage(Math.min(Math.max(1, n), totalPages)) }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "ouvertes",   label: "Ouvertes",   count: stats.ouvertes },
    { key: "payees",     label: "Payées",     count: stats.payees },
    { key: "brouillons", label: "Brouillons", count: stats.brouillons },
    { key: "tout",       label: "Tout",       count: stats.total },
  ]

  const showPayments = tab !== "brouillons"

  return (
    <div className="-m-6 min-h-screen bg-gray-50/50">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link
          href={`/${locale}/ventes/factures/nouveau`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition"
        >
          <Plus className="w-3.5 h-3.5" /> Nouveau
        </Link>

        <div className="flex items-center gap-1 ml-2">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1) }}
              className={`px-3 py-1.5 text-sm rounded transition font-medium ${
                tab === t.key
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs text-gray-400">({t.count})</span>
            </button>
          ))}
        </div>

        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-60"
          />
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, displayed.length)} / {displayed.length}</span>
          <button onClick={() => goPage(page - 1)} disabled={page === 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => goPage(page + 1)} disabled={page === totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-0.5 border border-gray-200 rounded p-0.5">
          <button className="p-1.5 rounded bg-gray-100 text-gray-700"><LayoutList className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 rounded text-gray-400 hover:bg-gray-50"><LayoutGrid className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-stretch gap-1">
          {[
            { label: "Ouvertes",   value: stats.ouvertes, color: stats.ouvertes > 0 ? "text-blue-600" : "text-gray-300",   bg: stats.ouvertes > 0 ? "bg-blue-50" : "" },
            { label: "En retard",  value: stats.enRetard, color: stats.enRetard > 0 ? "text-red-600" : "text-gray-300",    bg: stats.enRetard > 0 ? "bg-red-50" : "" },
            { label: "Payées",     value: stats.payees,   color: stats.payees > 0 ? "text-emerald-600" : "text-gray-300",  bg: stats.payees > 0 ? "bg-emerald-50" : "" },
            { label: "Brouillons", value: stats.brouillons, color: stats.brouillons > 0 ? "text-gray-600" : "text-gray-300", bg: "" },
          ].map(s => (
            <div key={s.label} className={`flex-1 flex flex-col items-center py-3 px-4 rounded-lg mx-1 ${s.bg}`}>
              <span className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</span>
              <span className="text-[11px] text-gray-400 mt-0.5">{s.label}</span>
            </div>
          ))}
          <div className="w-px bg-gray-200 mx-3" />
          <div className="flex flex-col items-end justify-center px-4">
            <span className="text-xs text-gray-400">À encaisser</span>
            <span className="text-lg font-bold text-red-600 tabular-nums">{stats.unpaidTotal}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        {paged.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-20 text-center text-gray-400">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune facture trouvée</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium">
                  <th className="w-8 px-4 py-3">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  <th className="text-left px-4 py-3">Numéro</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Date de facture</th>
                  <th className="text-left px-4 py-3">Échéance</th>
                  <th className="text-left px-4 py-3">Activités</th>
                  <th className="text-right px-4 py-3">Hors taxes</th>
                  {showPayments && <th className="text-right px-4 py-3">Encaissé</th>}
                  {showPayments && <th className="text-right px-4 py-3">Montant dû</th>}
                  <th className="text-left px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paged.map(i => {
                  const cfg = STATUS_CONFIG[i.status] ?? STATUS_CONFIG.draft
                  const due = relativeDate(i.due_date)
                  const isOpen = openStatuses.includes(i.status)
                  return (
                    <tr key={i.id} className={`hover:bg-blue-50/20 transition-colors ${due.overdue && isOpen ? "bg-red-50/20" : ""}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/${locale}/ventes/factures/${i.id}`} className="font-mono font-semibold text-blue-600 hover:underline text-xs">
                          {i.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{i.client_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {i.issue_date ? formatDate(i.issue_date, locale) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isOpen && i.due_date
                          ? <span className={due.overdue ? "text-red-600 font-semibold" : "text-gray-500"}>{due.label}</span>
                          : <span className="text-gray-400">{i.due_date ? formatDate(i.due_date, locale) : "—"}</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <Clock className="w-4 h-4 text-gray-300" />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 text-xs font-medium tabular-nums">
                        {formatCurrency(i.total_ht, i.currency as "GNF" | "USD" | "EUR")}
                      </td>
                      {showPayments && (
                        <td className="px-4 py-3 text-right text-xs tabular-nums">
                          {i.total_paid > 0
                            ? <span className="text-emerald-700">{formatCurrency(i.total_paid, i.currency as "GNF" | "USD" | "EUR")}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                      )}
                      {showPayments && (
                        <td className="px-4 py-3 text-right text-xs tabular-nums">
                          {i.balance > 0
                            ? <span className="font-bold text-red-600">{formatCurrency(i.balance, i.currency as "GNF" | "USD" | "EUR")}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Footer totals */}
              {tab !== "tout" && tab !== "brouillons" && Object.keys(stats.unpaid).length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={showPayments ? 7 : 6} className="px-4 py-3 text-xs text-gray-500 font-semibold">
                      Total dû ({displayed.filter(i => i.balance > 0).length} facture{displayed.filter(i => i.balance > 0).length !== 1 ? "s" : ""})
                    </td>
                    {showPayments && (
                      <td className="px-4 py-3 text-right text-xs font-bold text-red-600 tabular-nums">
                        {fmtMulti(displayed.reduce<Record<string, number>>((acc, i) => {
                          if (i.balance > 0) acc[i.currency] = (acc[i.currency] ?? 0) + i.balance
                          return acc
                        }, {}))}
                      </td>
                    )}
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>

            {displayed.length > pageSize && (
              <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between text-xs text-gray-500">
                <span>{displayed.length} enregistrements</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => goPage(page - 1)} disabled={page === 1} className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span>Page {page} / {totalPages}</span>
                  <button onClick={() => goPage(page + 1)} disabled={page === totalPages} className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
