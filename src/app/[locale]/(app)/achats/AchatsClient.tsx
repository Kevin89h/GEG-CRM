"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Plus, Search, LayoutList, LayoutGrid, ChevronLeft, ChevronRight,
  Clock, CheckCircle2, XCircle, FileText, AlertTriangle, Calendar,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface InvoiceRef {
  id: string
  number: string
  purchase_order_id: string
  status: string
}

interface Order {
  id: string
  number: string
  supplier_name: string
  status: string
  currency: string
  order_date: string | null
  expected_date: string | null
  user_id: string | null
  total: number
  invoice: InvoiceRef | null
}

interface Props {
  orders: Order[]
}

type Tab = "all" | "rfq" | "po"

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date(new Date().toDateString())
}

export default function AchatsClient({ orders }: Props) {
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations("achats")

  const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    draft:     { label: t("statusDraft"),     bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400" },
    sent:      { label: t("statusSent"),      bg: "bg-purple-50",  text: "text-purple-700",  dot: "bg-purple-400" },
    confirmed: { label: t("statusConfirmed"), bg: "bg-green-50",   text: "text-green-700",   dot: "bg-green-500" },
    received:  { label: t("statusReceived"),  bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
    cancelled: { label: t("statusCancelled"), bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-400" },
  }

  function relativeDate(dateStr: string | null, locale: string): { label: string; overdue: boolean } {
    if (!dateStr) return { label: "—", overdue: false }
    const d = new Date(dateStr)
    const now = new Date()
    const diff = Math.round((d.getTime() - now.getTime()) / 86400000)
    if (diff === 0) return { label: t("dateToday"), overdue: false }
    if (diff === -1) return { label: t("dateYesterday"), overdue: true }
    if (diff < 0) return { label: t("dateDaysAgo", { count: Math.abs(diff) }), overdue: true }
    if (diff === 1) return { label: t("dateTomorrow"), overdue: false }
    return { label: formatDate(dateStr, locale), overdue: false }
  }

  type SortField = "number" | "supplier_name" | "order_date" | "expected_date" | "total"
  type SortDir = "asc" | "desc"

  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("order_date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

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

  const today = new Date(new Date().toDateString())

  const rfqOrders = orders.filter(o => o.status === "draft" || o.status === "sent")
  const poOrders  = orders.filter(o => o.status === "confirmed" || o.status === "received")

  const stats = useMemo(() => ({
    nouveau:         orders.filter(o => o.status === "draft").length,
    envoye:          orders.filter(o => o.status === "sent").length,
    rfqEnRetard:     rfqOrders.filter(o => isOverdue(o.expected_date)).length,
    nonConfirme:     rfqOrders.length,
    receptionEnRetard: orders.filter(o => o.status === "confirmed" && isOverdue(o.expected_date)).length,
    otd: (() => {
      const received = orders.filter(o => o.status === "received" && o.expected_date)
      if (!received.length) return 100
      const onTime = received.filter(o => !isOverdue(o.expected_date)).length
      return Math.round((onTime / received.length) * 100)
    })(),
    avgDays: (() => {
      const withDates = orders.filter(o => o.order_date && o.expected_date)
      if (!withDates.length) return 0
      const avg = withDates.reduce((s, o) => {
        const diff = (new Date(o.expected_date!).getTime() - new Date(o.order_date!).getTime()) / 86400000
        return s + Math.max(0, diff)
      }, 0) / withDates.length
      return Math.round(avg * 100) / 100
    })(),
  }), [orders, rfqOrders])

  const displayed = useMemo(() => {
    let base = tab === "rfq" ? rfqOrders : tab === "po" ? poOrders : orders
    if (search) {
      const q = search.toLowerCase()
      base = base.filter(o =>
        o.number.toLowerCase().includes(q) ||
        o.supplier_name.toLowerCase().includes(q)
      )
    }
    const dir = sortDir === "asc" ? 1 : -1
    base = [...base].sort((a, b) => {
      switch (sortField) {
        case "number":        return dir * (a.number ?? "").localeCompare(b.number ?? "")
        case "supplier_name": return dir * a.supplier_name.localeCompare(b.supplier_name)
        case "order_date":    return dir * ((a.order_date ?? "") < (b.order_date ?? "") ? -1 : 1)
        case "expected_date": return dir * ((a.expected_date ?? "") < (b.expected_date ?? "") ? -1 : 1)
        case "total":         return dir * (a.total - b.total)
        default: return 0
      }
    })
    return base
  }, [tab, search, sortField, sortDir, orders, rfqOrders, poOrders])

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: t("tabAll"),  count: orders.length },
    { key: "rfq", label: t("tabRfq"),  count: rfqOrders.length },
    { key: "po",  label: t("tabPo"),   count: poOrders.length },
  ]

  return (
    <div className="-mx-4 -my-4 md:-m-6 min-h-screen bg-gray-50/50">
      {/* Top toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-2">
        <Link
          href={`/${locale}/achats/nouveau`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition"
        >
          <Plus className="w-3.5 h-3.5" /> {t("btnNew")}
        </Link>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setTab(tab.key);  }}
              className={`whitespace-nowrap px-3 py-1.5 text-sm rounded transition font-medium ${
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

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value);  }}
            placeholder={t("searchPlaceholder")}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-full sm:w-60"
          />
        </div>

        <span className="text-xs text-gray-400">{displayed.length} commande{displayed.length !== 1 ? "s" : ""}</span>

        {/* View toggles */}
        <div className="flex items-center gap-0.5 border border-gray-200 rounded p-0.5">
          <button className="p-1.5 rounded bg-gray-100 text-gray-700"><LayoutList className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 rounded text-gray-400 hover:bg-gray-50"><LayoutGrid className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 rounded text-gray-400 hover:bg-gray-50"><Calendar className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-200 px-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide">
              <th className="py-2 pr-6 font-medium text-left w-16"></th>
              <th className="py-2 px-4 font-medium text-center">{t("statsNew")}</th>
              <th className="py-2 px-4 font-medium text-center">{t("statsSent")}</th>
              <th className="py-2 px-4 font-medium text-center text-orange-500">{t("statsRfqOverdue")}</th>
              <th className="py-2 px-4 font-medium text-center">{t("statsUnconfirmed")}</th>
              <th className="py-2 px-4 font-medium text-center text-red-500">{t("statsReceiptOverdue")}</th>
              <th className="py-2 px-4 font-medium text-center">OTD</th>
              <th className="py-2 px-4 font-medium text-center">{t("statsDaysToOrder")}</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: t("statsRowAll"), nouveau: stats.nouveau, envoye: stats.envoye, retard: stats.rfqEnRetard, nonConf: stats.nonConfirme, recepRetard: stats.receptionEnRetard, otd: stats.otd, jours: stats.avgDays },
              { label: t("statsRowMine"), nouveau: 0,             envoye: 0,           retard: 0,                  nonConf: 0,                recepRetard: 0,                        otd: 100,       jours: 0 },
            ].map(row => (
              <tr key={row.label} className="border-t border-gray-100">
                <td className="py-2 pr-6 text-xs font-medium text-gray-500">{row.label}</td>
                <td className="py-2 px-4 text-center">
                  <button className="group flex flex-col items-center gap-0.5 mx-auto hover:text-blue-600 transition">
                    <span className={`text-lg font-semibold ${row.nouveau > 0 ? "text-blue-600" : "text-gray-400"}`}>{row.nouveau}</span>
                    <span className="text-[10px] text-gray-400 group-hover:text-blue-500">{t("statsNew")}</span>
                  </button>
                </td>
                <td className="py-2 px-4 text-center">
                  <span className={`text-lg font-semibold ${row.envoye > 0 ? "text-gray-700" : "text-gray-300"}`}>{row.envoye}</span>
                </td>
                <td className="py-2 px-4 text-center">
                  <span className={`text-lg font-semibold ${row.retard > 0 ? "text-orange-500" : "text-gray-300"}`}>{row.retard}</span>
                </td>
                <td className="py-2 px-4 text-center">
                  <span className={`text-lg font-semibold ${row.nonConf > 0 ? "text-blue-500" : "text-gray-300"}`}>{row.nonConf}</span>
                </td>
                <td className="py-2 px-4 text-center">
                  <span className={`text-lg font-semibold ${row.recepRetard > 0 ? "text-red-500" : "text-gray-300"}`}>{row.recepRetard}</span>
                </td>
                <td className="py-2 px-4 text-center">
                  <span className={`text-lg font-semibold ${row.otd < 80 ? "text-red-500" : "text-gray-700"}`}>{row.otd} %</span>
                </td>
                <td className="py-2 px-4 text-center">
                  <span className="text-lg font-semibold text-gray-700">{row.jours.toFixed(2)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Main table */}
      <div className="px-4 py-4">
        {displayed.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-20 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t("emptyOrders")}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium">
                  <th className="w-8 px-4 py-3 hidden sm:table-cell">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort("number")} className="flex items-center hover:text-gray-900 transition">
                      {t("colReference")} <SortIcon field="number" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort("supplier_name")} className="flex items-center hover:text-gray-900 transition">
                      {t("colSupplier")} <SortIcon field="supplier_name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">{t("colCompany")}</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">{t("colBuyer")}</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">
                    <button onClick={() => handleSort("expected_date")} className="flex items-center hover:text-gray-900 transition">
                      {t("colDueDate")} <SortIcon field="expected_date" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">{t("colActivities")}</th>
                  <th className="text-right px-4 py-3">
                    <button onClick={() => handleSort("total")} className="flex items-center ml-auto hover:text-gray-900 transition">
                      {t("colTotal")} <SortIcon field="total" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Facture</th>
                  <th className="text-left px-4 py-3">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map(o => {
                  const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.draft
                  const date = relativeDate(o.expected_date, locale)
                  return (
                    <tr key={o.id} className="hover:bg-blue-50/20 transition-colors group">
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/achats/${o.id}`}
                          className="font-mono font-semibold text-blue-600 hover:underline text-xs"
                        >
                          {o.number || "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{o.supplier_name}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">GEG SAS Guinée</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-[10px] font-bold">
                          L
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`text-xs ${date.overdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                          {date.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <Clock className="w-4 h-4 text-gray-300" />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 text-xs tabular-nums">
                        {o.total > 0
                          ? formatCurrency(o.total, o.currency as "GNF" | "USD" | "EUR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {o.invoice ? (
                          <Link
                            href={`/${locale}/comptabilite/factures-fournisseurs/${o.invoice.id}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            <FileText className="w-3 h-3" />
                            {o.invoice.number}
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
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
            </table>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
