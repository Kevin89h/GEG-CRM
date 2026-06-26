"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  Plus, Search, ChevronLeft, ChevronRight, LayoutList, LayoutGrid,
  FileText, Clock,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Order {
  id: string
  number: string
  status: string
  currency: string
  account_id: string | null
  created_at: string
  total_ht: number
  salesperson_id: string | null
  client_name: string
  salesperson_name: string
}

interface Props {
  orders: Order[]
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  draft:     { label: "Devis",           bg: "bg-gray-50",    text: "text-gray-600",    dot: "bg-gray-400" },
  confirmed: { label: "Bon de commande", bg: "bg-green-50",   text: "text-green-700",   dot: "bg-green-500" },
  invoiced:  { label: "Facturé",         bg: "bg-purple-50",  text: "text-purple-700",  dot: "bg-purple-500" },
  cancelled: { label: "Annulé",          bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-400" },
}

type Tab = "all" | "draft" | "confirmed"

export default function DevisClient({ orders }: Props) {
  const params = useParams()
  const locale = params.locale as string

  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 20

  const drafts     = orders.filter(o => o.status === "draft")
  const confirmed  = orders.filter(o => o.status === "confirmed")
  const invoiced   = orders.filter(o => o.status === "invoiced")
  const cancelled  = orders.filter(o => o.status === "cancelled")
  const toInvoice  = confirmed  // confirmed but not yet invoiced

  const stats = useMemo(() => ({
    devis:        drafts.length,
    bonCommande:  confirmed.length,
    aFacturer:    toInvoice.length,
    annule:       cancelled.length,
    pipeline:     confirmed.reduce((s, o) => s + o.total_ht, 0),
    pipelineCur:  confirmed[0]?.currency ?? "GNF",
  }), [orders])

  const displayed = useMemo(() => {
    let base = tab === "draft" ? drafts : tab === "confirmed" ? confirmed : orders
    if (search) {
      const q = search.toLowerCase()
      base = base.filter(o =>
        o.number.toLowerCase().includes(q) ||
        o.client_name.toLowerCase().includes(q)
      )
    }
    return base
  }, [tab, search, orders, drafts, confirmed])

  const totalPages = Math.max(1, Math.ceil(displayed.length / pageSize))
  const paged = displayed.slice((page - 1) * pageSize, page * pageSize)
  function goPage(n: number) { setPage(Math.min(Math.max(1, n), totalPages)) }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "all",       label: "Tout",            count: orders.length },
    { key: "draft",     label: "Devis",           count: drafts.length },
    { key: "confirmed", label: "Bons de commande", count: confirmed.length },
  ]

  return (
    <div className="-m-6 min-h-screen bg-gray-50/50">
      {/* Top toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link
          href={`/${locale}/ventes/devis/nouveau`}
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

        <div className="flex items-center gap-0.5 border border-gray-200 rounded p-0.5">
          <button className="p-1.5 rounded bg-gray-100 text-gray-700"><LayoutList className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 rounded text-gray-400 hover:bg-gray-50"><LayoutGrid className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-stretch gap-px">
          {[
            { label: "Devis",            value: stats.devis,       color: stats.devis > 0 ? "text-blue-600" : "text-gray-300",   bg: stats.devis > 0 ? "bg-blue-50" : "" },
            { label: "Bon de commande",  value: stats.bonCommande, color: stats.bonCommande > 0 ? "text-green-600" : "text-gray-300", bg: stats.bonCommande > 0 ? "bg-green-50" : "" },
            { label: "À facturer",       value: stats.aFacturer,   color: stats.aFacturer > 0 ? "text-orange-500" : "text-gray-300", bg: stats.aFacturer > 0 ? "bg-orange-50" : "" },
            { label: "Annulé",           value: stats.annule,      color: stats.annule > 0 ? "text-red-500" : "text-gray-300",   bg: "" },
          ].map(s => (
            <div key={s.label} className={`flex-1 flex flex-col items-center py-3 px-4 rounded-lg mx-1 ${s.bg}`}>
              <span className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</span>
              <span className="text-[11px] text-gray-400 mt-0.5 text-center">{s.label}</span>
            </div>
          ))}
          <div className="w-px bg-gray-200 mx-3" />
          <div className="flex flex-col items-end justify-center px-4">
            <span className="text-xs text-gray-400">Pipeline confirmé</span>
            <span className="text-lg font-bold text-gray-800 tabular-nums">
              {formatCurrency(stats.pipeline, stats.pipelineCur as "GNF" | "USD" | "EUR")}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        {paged.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-20 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun devis trouvé</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium">
                  <th className="w-8 px-4 py-3">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  <th className="text-left px-4 py-3">N° Commande</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Vendeur</th>
                  <th className="text-left px-4 py-3">Date de commande</th>
                  <th className="text-left px-4 py-3">Activités</th>
                  <th className="text-right px-4 py-3">Total HT</th>
                  <th className="text-left px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paged.map(o => {
                  const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.draft
                  return (
                    <tr key={o.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/ventes/devis/${o.id}`}
                          className="font-mono font-semibold text-blue-600 hover:underline text-xs"
                        >
                          {o.number || "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{o.client_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{o.salesperson_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(o.created_at, locale)}</td>
                      <td className="px-4 py-3">
                        <Clock className="w-4 h-4 text-gray-300" />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 text-xs tabular-nums">
                        {formatCurrency(o.total_ht, o.currency as "GNF" | "USD" | "EUR")}
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
