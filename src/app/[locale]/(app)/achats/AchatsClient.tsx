"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  Plus, Search, LayoutList, LayoutGrid, ChevronLeft, ChevronRight,
  Clock, CheckCircle2, XCircle, FileText, AlertTriangle, Calendar,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

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
}

interface Props {
  orders: Order[]
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  draft:     { label: "Demande de prix", bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400" },
  sent:      { label: "Envoyé",          bg: "bg-purple-50",  text: "text-purple-700",  dot: "bg-purple-400" },
  confirmed: { label: "Bon de commande", bg: "bg-green-50",   text: "text-green-700",   dot: "bg-green-500" },
  received:  { label: "Réceptionné",     bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelled: { label: "Annulé",          bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-400" },
}

type Tab = "all" | "rfq" | "po"

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date(new Date().toDateString())
}

function relativeDate(dateStr: string | null, locale: string): { label: string; overdue: boolean } {
  if (!dateStr) return { label: "—", overdue: false }
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000)
  if (diff === 0) return { label: "Aujourd'hui", overdue: false }
  if (diff === -1) return { label: "Hier", overdue: true }
  if (diff < 0) return { label: `Il y a ${Math.abs(diff)} jours`, overdue: true }
  if (diff === 1) return { label: "Demain", overdue: false }
  return { label: formatDate(dateStr, locale), overdue: false }
}

export default function AchatsClient({ orders }: Props) {
  const params = useParams()
  const locale = params.locale as string

  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 20

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
    return base
  }, [tab, search, orders, rfqOrders, poOrders])

  const totalPages = Math.max(1, Math.ceil(displayed.length / pageSize))
  const paged = displayed.slice((page - 1) * pageSize, page * pageSize)

  function goPage(n: number) { setPage(Math.min(Math.max(1, n), totalPages)) }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "Toutes",          count: orders.length },
    { key: "rfq", label: "Demandes de prix", count: rfqOrders.length },
    { key: "po",  label: "Bons de commande", count: poOrders.length },
  ]

  return (
    <div className="-m-6 min-h-screen bg-gray-50/50">
      {/* Top toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link
          href={`/${locale}/achats/nouveau`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition"
        >
          <Plus className="w-3.5 h-3.5" /> Nouveau
        </Link>

        {/* Tabs */}
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

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-60"
          />
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, displayed.length)} / {displayed.length}</span>
          <button onClick={() => goPage(page - 1)} disabled={page === 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => goPage(page + 1)} disabled={page === totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-0.5 border border-gray-200 rounded p-0.5">
          <button className="p-1.5 rounded bg-gray-100 text-gray-700"><LayoutList className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 rounded text-gray-400 hover:bg-gray-50"><LayoutGrid className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 rounded text-gray-400 hover:bg-gray-50"><Calendar className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide">
              <th className="py-2 pr-6 font-medium text-left w-16"></th>
              <th className="py-2 px-4 font-medium text-center">Nouveau</th>
              <th className="py-2 px-4 font-medium text-center">Envoyé</th>
              <th className="py-2 px-4 font-medium text-center text-orange-500">Demande de prix en retard</th>
              <th className="py-2 px-4 font-medium text-center">Non confirmé</th>
              <th className="py-2 px-4 font-medium text-center text-red-500">Réception en retard</th>
              <th className="py-2 px-4 font-medium text-center">OTD</th>
              <th className="py-2 px-4 font-medium text-center">Jours pour commander</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Tous",  nouveau: stats.nouveau, envoye: stats.envoye, retard: stats.rfqEnRetard, nonConf: stats.nonConfirme, recepRetard: stats.receptionEnRetard, otd: stats.otd, jours: stats.avgDays },
              { label: "Mes",   nouveau: 0,             envoye: 0,           retard: 0,                  nonConf: 0,                recepRetard: 0,                        otd: 100,       jours: 0 },
            ].map(row => (
              <tr key={row.label} className="border-t border-gray-100">
                <td className="py-2 pr-6 text-xs font-medium text-gray-500">{row.label}</td>
                <td className="py-2 px-4 text-center">
                  <button className="group flex flex-col items-center gap-0.5 mx-auto hover:text-blue-600 transition">
                    <span className={`text-lg font-semibold ${row.nouveau > 0 ? "text-blue-600" : "text-gray-400"}`}>{row.nouveau}</span>
                    <span className="text-[10px] text-gray-400 group-hover:text-blue-500">Nouveau</span>
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
      <div className="px-6 py-4">
        {paged.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-20 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune commande trouvée</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium">
                  <th className="w-8 px-4 py-3">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  <th className="text-left px-4 py-3">Référence</th>
                  <th className="text-left px-4 py-3">Fournisseur</th>
                  <th className="text-left px-4 py-3">Société</th>
                  <th className="text-left px-4 py-3">Acheteur</th>
                  <th className="text-left px-4 py-3">Échéance de commande</th>
                  <th className="text-left px-4 py-3">Activités</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paged.map(o => {
                  const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.draft
                  const date = relativeDate(o.expected_date, locale)
                  return (
                    <tr key={o.id} className="hover:bg-blue-50/20 transition-colors group">
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-gray-500">GEG SAS Guinée</td>
                      <td className="px-4 py-3">
                        <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-[10px] font-bold">
                          L
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${date.overdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                          {date.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Clock className="w-4 h-4 text-gray-300" />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 text-xs tabular-nums">
                        {o.total > 0
                          ? formatCurrency(o.total, o.currency as "GNF" | "USD" | "EUR")
                          : "—"}
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

            {/* Footer */}
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
