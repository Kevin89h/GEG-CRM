"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Plus, Search, ChevronLeft, ChevronRight, LayoutList, LayoutGrid,
  Receipt, Clock, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, Download,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { exportToXls } from "@/lib/exportXls"

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

type Tab = "ouvertes" | "payees" | "brouillons" | "tout"

function fmtMulti(byCur: Record<string, number>) {
  return Object.entries(byCur)
    .filter(([, v]) => v > 0)
    .map(([cur, val]) => formatCurrency(val, cur as "GNF" | "USD" | "EUR"))
    .join(" · ") || "—"
}

export default function FacturesClient({ invoices }: Props) {
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations("factures")

  const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    draft:     { label: t("statusDraft"),     bg: "bg-gray-50",    text: "text-gray-600",    dot: "bg-gray-400" },
    sent:      { label: t("statusSent"),      bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
    partial:   { label: t("statusPartial"),   bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400" },
    paid:      { label: t("statusPaid"),      bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
    cancelled: { label: t("statusCancelled"), bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-400" },
  }

  function relativeDate(dateStr: string | null): { label: string; overdue: boolean } {
    if (!dateStr) return { label: "—", overdue: false }
    const d = new Date(dateStr)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const diff = Math.round((d.getTime() - now.getTime()) / 86400000)
    if (diff === 0) return { label: t("today"), overdue: false }
    if (diff === -1) return { label: t("yesterday"), overdue: true }
    if (diff === 1) return { label: t("tomorrow"), overdue: false }
    if (diff < 0) return { label: t("daysAgo", { count: Math.abs(diff) }), overdue: true }
    if (diff <= 30) return { label: t("inDays", { count: diff }), overdue: false }
    return { label: formatDate(dateStr, "fr"), overdue: false }
  }

  type SortField = "number" | "client_name" | "issue_date" | "due_date" | "total_ht" | "balance"
  type SortDir = "asc" | "desc"

  const [tab, setTab] = useState<Tab>("ouvertes")
  const [search, setSearch] = useState("")
  const [filterCurrency, setFilterCurrency] = useState<string>("all")
  const [filterOverdue, setFilterOverdue] = useState(false)
  const [sortField, setSortField] = useState<SortField>("issue_date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev => prev.size === displayed.length ? new Set() : new Set(displayed.map(i => i.id)))
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-30" />
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1 text-blue-500" />
      : <ChevronDown className="w-3 h-3 ml-1 text-blue-500" />
  }

  const currencies = useMemo(() => {
    const set = new Set(invoices.map(i => i.currency).filter(Boolean))
    return Array.from(set).sort()
  }, [invoices])

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
    if (filterCurrency !== "all") base = base.filter(i => i.currency === filterCurrency)
    if (filterOverdue) {
      const today = new Date(); today.setHours(0,0,0,0)
      base = base.filter(i => openStatuses.includes(i.status) && i.due_date && new Date(i.due_date) < today)
    }

    const dir = sortDir === "asc" ? 1 : -1
    base = [...base].sort((a, b) => {
      switch (sortField) {
        case "number":      return dir * a.number.localeCompare(b.number)
        case "client_name": return dir * (a.client_name ?? "").localeCompare(b.client_name ?? "")
        case "issue_date":  return dir * ((a.issue_date ?? "") < (b.issue_date ?? "") ? -1 : 1)
        case "due_date":    return dir * ((a.due_date ?? "") < (b.due_date ?? "") ? -1 : 1)
        case "total_ht":    return dir * (a.total_ht - b.total_ht)
        case "balance":     return dir * (a.balance - b.balance)
        default: return 0
      }
    })
    return base
  }, [tab, search, filterCurrency, filterOverdue, sortField, sortDir, invoices])

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "ouvertes",   label: t("tabOpen"),    count: stats.ouvertes },
    { key: "payees",     label: t("tabPaid"),    count: stats.payees },
    { key: "brouillons", label: t("tabDraft"),   count: stats.brouillons },
    { key: "tout",       label: t("tabAll"),     count: stats.total },
  ]

  const showPayments = tab !== "brouillons"

  const selectionTotals = useMemo(() => {
    if (selected.size === 0) return null
    const totals: Record<string, number> = {}
    for (const inv of displayed) {
      if (!selected.has(inv.id)) continue
      totals[inv.currency] = (totals[inv.currency] ?? 0) + Number(inv.balance ?? inv.total_ht)
    }
    return totals
  }, [selected, displayed])

  return (
    <div className="-m-6 min-h-screen bg-gray-50/50">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link
          href={`/${locale}/ventes/factures/nouveau`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition"
        >
          <Plus className="w-3.5 h-3.5" /> {t("new")}
        </Link>
        <button
          onClick={() => exportToXls(displayed.map(i => ({
            "Numéro": i.number,
            "Client": i.client_name,
            "Statut": i.status,
            "Date émission": i.issue_date ?? "",
            "Date échéance": i.due_date ?? "",
            "Total HT": i.total_ht,
            "Payé": i.total_paid,
            "Solde": i.balance,
            "Devise": i.currency,
          })), "factures")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
        >
          <Download className="w-3.5 h-3.5" /> Export XLS
        </button>

        <div className="flex items-center gap-1 ml-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setTab(tab.key);  }}
              className={`px-3 py-1.5 text-sm rounded transition font-medium ${
                tab.key === tab.key
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs text-gray-400">({tab.count})</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Currency filter */}
          {currencies.length > 1 && (
            <select
              value={filterCurrency}
              onChange={e => { setFilterCurrency(e.target.value);  }}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">Toutes devises</option>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {/* Overdue filter */}
          <button
            onClick={() => { setFilterOverdue(v => !v);  }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border transition font-medium ${
              filterOverdue
                ? "bg-red-50 border-red-300 text-red-700"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            <AlertTriangle className="w-3 h-3" /> En retard
          </button>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value);  }}
              placeholder={t("searchPlaceholder")}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-52"
            />
          </div>
        </div>

        <span className="text-xs text-gray-400">{displayed.length} facture{displayed.length !== 1 ? "s" : ""}</span>

        <div className="flex items-center gap-0.5 border border-gray-200 rounded p-0.5">
          <button className="p-1.5 rounded bg-gray-100 text-gray-700"><LayoutList className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 rounded text-gray-400 hover:bg-gray-50"><LayoutGrid className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-stretch gap-1">
          {[
            { label: t("statOpen"),    value: stats.ouvertes,   color: stats.ouvertes > 0 ? "text-blue-600" : "text-gray-300",    bg: stats.ouvertes > 0 ? "bg-blue-50" : "" },
            { label: t("statOverdue"), value: stats.enRetard,   color: stats.enRetard > 0 ? "text-red-600" : "text-gray-300",     bg: stats.enRetard > 0 ? "bg-red-50" : "" },
            { label: t("statPaid"),    value: stats.payees,     color: stats.payees > 0 ? "text-emerald-600" : "text-gray-300",   bg: stats.payees > 0 ? "bg-emerald-50" : "" },
            { label: t("statDraft"),   value: stats.brouillons, color: stats.brouillons > 0 ? "text-gray-600" : "text-gray-300",  bg: "" },
          ].map(s => (
            <div key={s.label} className={`flex-1 flex flex-col items-center py-3 px-4 rounded-lg mx-1 ${s.bg}`}>
              <span className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</span>
              <span className="text-[11px] text-gray-400 mt-0.5">{s.label}</span>
            </div>
          ))}
          <div className="w-px bg-gray-200 mx-3" />
          <div className="flex flex-col items-end justify-center px-4">
            <span className="text-xs text-gray-400">{t("toCollect")}</span>
            <span className="text-lg font-bold text-red-600 tabular-nums">{stats.unpaidTotal}</span>
          </div>
        </div>
      </div>

      {/* Bandeau sous-total sélection */}
      {selectionTotals && (
        <div className="mx-6 mt-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
          <span className="text-sm font-medium text-blue-700">
            {selected.size} facture{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-4">
            {Object.entries(selectionTotals).map(([cur, total]) => (
              <span key={cur} className="text-sm font-bold text-blue-900">
                {formatCurrency(total, cur as "GNF" | "USD" | "EUR")}
              </span>
            ))}
            <button onClick={() => setSelected(new Set())} className="text-blue-400 hover:text-blue-700 ml-2 text-lg leading-none">×</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="px-6 py-4">
        {displayed.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-20 text-center text-gray-400">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t("noInvoiceFound")}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-y-auto max-h-[calc(100vh-280px)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium">
                  <th className="w-8 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === displayed.length && displayed.length > 0}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort("number")} className="flex items-center hover:text-gray-900 transition">
                      {t("colNumber")} <SortIcon field="number" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort("client_name")} className="flex items-center hover:text-gray-900 transition">
                      {t("colClient")} <SortIcon field="client_name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort("issue_date")} className="flex items-center hover:text-gray-900 transition">
                      {t("colIssueDate")} <SortIcon field="issue_date" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort("due_date")} className="flex items-center hover:text-gray-900 transition">
                      {t("colDueDate")} <SortIcon field="due_date" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">{t("colActivities")}</th>
                  <th className="text-right px-4 py-3">
                    <button onClick={() => handleSort("total_ht")} className="flex items-center ml-auto hover:text-gray-900 transition">
                      {t("colHt")} <SortIcon field="total_ht" />
                    </button>
                  </th>
                  {showPayments && <th className="text-right px-4 py-3">{t("colCollected")}</th>}
                  {showPayments && (
                    <th className="text-right px-4 py-3">
                      <button onClick={() => handleSort("balance")} className="flex items-center ml-auto hover:text-gray-900 transition">
                        {t("colAmountDue")} <SortIcon field="balance" />
                      </button>
                    </th>
                  )}
                  <th className="text-left px-4 py-3">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map(i => {
                  const cfg = STATUS_CONFIG[i.status] ?? STATUS_CONFIG.draft
                  const due = relativeDate(i.due_date)
                  const isOpen = openStatuses.includes(i.status)
                  return (
                    <tr key={i.id} onClick={() => toggleSelect(i.id)} className={`cursor-pointer hover:bg-blue-50/20 transition-colors ${selected.has(i.id) ? "bg-blue-50" : due.overdue && isOpen ? "bg-red-50/20" : ""}`}>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(i.id)}
                          onChange={() => toggleSelect(i.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
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
                      {t("totalDue", { count: displayed.filter(i => i.balance > 0).length })}
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
