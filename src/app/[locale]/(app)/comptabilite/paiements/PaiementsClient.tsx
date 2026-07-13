"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Search, CreditCard, Building2, Smartphone, Banknote, ChevronLeft, ChevronRight } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Payment {
  id: string
  number: string
  amount: number
  currency: "GNF" | "USD" | "EUR"
  method: string
  paid_at: string
  invoice_number: string | null
  invoice_id: string | null
  invoice_status: string | null
  client_name: string | null
  journal_name: string | null
  journal_type: string | null
}

interface Props {
  payments: Payment[]
  locale: string
}

const PAGE_SIZE = 80

const statusConfig: Record<string, { label: string; className: string }> = {
  paid:     { label: "Payé",                  className: "bg-green-100 text-green-700 border border-green-200" },
  partial:  { label: "Partiel",               className: "bg-yellow-100 text-yellow-700 border border-yellow-200" },
  sent:     { label: "En cours de traitement", className: "bg-orange-100 text-orange-700 border border-orange-200" },
  draft:    { label: "Brouillon",             className: "bg-gray-100 text-gray-600 border border-gray-200" },
  overdue:  { label: "En retard",             className: "bg-red-100 text-red-700 border border-red-200" },
}

const journalIcon = {
  bank: Building2,
  mobile_money: Smartphone,
  cash: Banknote,
}

function fmtDate(iso: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: undefined })
}

export default function PaiementsClient({ payments, locale }: Props) {
  const [search, setSearch] = useState("")
  const [filterJournal, setFilterJournal] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [page, setPage] = useState(1)

  const journals = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of payments) {
      if (p.journal_name) seen.set(p.journal_name, p.journal_name)
    }
    return Array.from(seen.entries())
  }, [payments])

  const filtered = useMemo(() => payments.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q
      || p.number.toLowerCase().includes(q)
      || (p.client_name ?? "").toLowerCase().includes(q)
      || (p.invoice_number ?? "").toLowerCase().includes(q)
    const matchJournal = filterJournal === "all" || p.journal_name === filterJournal
    const matchStatus = filterStatus === "all" || p.invoice_status === filterStatus
    return matchSearch && matchJournal && matchStatus
  }), [payments, search, filterJournal, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const slice = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const totalAmount = filtered.reduce((s, p) => s + p.amount, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} paiement{filtered.length !== 1 ? "s" : ""} &nbsp;·&nbsp;
            <span className="font-semibold text-gray-700">
              {formatCurrency(totalAmount, "GNF")}
            </span>
          </p>
        </div>
        <Link
          href={`/${locale}/ventes/factures`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
        >
          <CreditCard className="w-4 h-4" />
          Nouveau paiement
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Journal filter */}
        <select
          value={filterJournal}
          onChange={e => { setFilterJournal(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Tous les journaux</option>
          {journals.map(([name]) => <option key={name} value={name}>{name}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Tous les statuts</option>
          <option value="paid">Payé</option>
          <option value="sent">En cours</option>
          <option value="partial">Partiel</option>
          <option value="draft">Brouillon</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Count + pagination header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
          <span>{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} sur {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Date</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Numéro</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Journal</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Mode</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Client</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Montant</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {slice.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Aucun paiement trouvé</p>
                </td>
              </tr>
            ) : slice.map(p => {
              const Icon = journalIcon[(p.journal_type ?? "bank") as keyof typeof journalIcon] ?? Building2
              const status = statusConfig[p.invoice_status ?? ""] ?? { label: "—", className: "bg-gray-100 text-gray-500 border border-gray-200" }
              return (
                <tr
                  key={p.id}
                  className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                  onClick={() => p.invoice_id && (window.location.href = `/${locale}/ventes/factures/${p.invoice_id}`)}
                >
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(p.paid_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{p.number}</td>
                  <td className="px-4 py-3">
                    {p.journal_name ? (
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {p.journal_name}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.method}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[220px] truncate">{p.client_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                    {formatCurrency(p.amount, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
