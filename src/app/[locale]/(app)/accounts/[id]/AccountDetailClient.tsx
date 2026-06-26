"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Receipt, ShoppingCart, Landmark, Clock, TrendingUp, ExternalLink, Trash2, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import Link from "next/link"

interface SalesOrder {
  id: string
  number: string
  status: string
  currency: string
  created_at: string
  total: number
  salesperson?: { full_name: string } | null
}

interface Invoice {
  id: string
  number: string
  status: string
  currency: string
  issue_date: string
  due_date: string | null
  total: number
  total_paid: number
  balance: number
}

interface Account {
  id: string
  name: string
  type: string
  industry: string | null
  country: string
  city: string | null
  phone: string | null
  email: string | null
  salesperson?: { full_name: string } | null
}

interface Props {
  account: Account
  orders: SalesOrder[]
  invoices: Invoice[]
  locale: string
}

type Period = "30" | "90" | "365" | "all" | "custom"

const orderStatusColor: Record<string, "gray" | "blue" | "yellow" | "green" | "red"> = {
  draft: "gray", confirmed: "blue", invoiced: "yellow", cancelled: "red",
}
const orderStatusLabel: Record<string, string> = {
  draft: "Brouillon", confirmed: "Confirmé", invoiced: "Facturé", cancelled: "Annulé",
}
const invoiceStatusColor: Record<string, "gray" | "blue" | "yellow" | "green" | "red"> = {
  draft: "gray", sent: "blue", partial: "yellow", paid: "green", cancelled: "red",
}
const invoiceStatusLabel: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyée", partial: "Partiel", paid: "Payée", cancelled: "Annulée",
}

function groupByCurrency<T extends { currency: string; total: number }>(items: T[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, i) => {
    acc[i.currency] = (acc[i.currency] ?? 0) + i.total
    return acc
  }, {})
}

function fmtMulti(byCur: Record<string, number>): string {
  const entries = Object.entries(byCur).filter(([, v]) => v > 0)
  if (entries.length === 0) return "0"
  return entries.map(([cur, val]) => formatCurrency(val, cur as "GNF" | "USD" | "EUR")).join(" · ")
}

function periodStart(period: Period, customFrom: string): Date | null {
  if (period === "all") return null
  if (period === "custom") return customFrom ? new Date(customFrom) : null
  const d = new Date()
  d.setDate(d.getDate() - parseInt(period))
  return d
}

export default function AccountDetailClient({ account, orders, invoices, locale }: Props) {
  const router = useRouter()
  const { supabase, db } = getCompanyClientBrowser()
  const [period, setPeriod] = useState<Period>("all")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [tab, setTab] = useState<"devis" | "factures">("factures")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const hasOpenInvoices = invoices.some(i => i.status !== "paid" && i.status !== "cancelled")
  const hasActiveOrders = orders.some(o => o.status !== "cancelled")

  async function handleDelete() {
    setDeleting(true)
    setDeleteError("")
    const { error } = await db.from("accounts").delete().eq("id", account.id)
    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
    } else {
      router.push(`/${locale}/accounts`)
    }
  }

  const from = periodStart(period, customFrom)
  const to = period === "custom" && customTo ? new Date(customTo + "T23:59:59") : null

  function inPeriod(dateStr: string): boolean {
    const d = new Date(dateStr)
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  }

  const filteredOrders = useMemo(
    () => orders.filter(o => inPeriod(o.created_at)).filter(o => o.status !== "cancelled"),
    [orders, period, customFrom, customTo]
  )
  const filteredInvoices = useMemo(
    () => invoices.filter(i => inPeriod(i.issue_date)).filter(i => i.status !== "cancelled"),
    [invoices, period, customFrom, customTo]
  )

  const totalOrdered = groupByCurrency(filteredOrders)
  const totalInvoiced = groupByCurrency(filteredInvoices)
  const totalPaid = filteredInvoices.reduce<Record<string, number>>((acc, i) => {
    acc[i.currency] = (acc[i.currency] ?? 0) + i.total_paid
    return acc
  }, {})
  const totalDue = filteredInvoices.reduce<Record<string, number>>((acc, i) => {
    if (i.status !== "paid") acc[i.currency] = (acc[i.currency] ?? 0) + i.balance
    return acc
  }, {})

  const PERIODS: { key: Period; label: string }[] = [
    { key: "30", label: "30 jours" },
    { key: "90", label: "3 mois" },
    { key: "365", label: "12 mois" },
    { key: "all", label: "Tout" },
    { key: "custom", label: "Période custom" },
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Supprimer ce compte ?</h3>
                <p className="text-sm text-gray-500">{account.name}</p>
              </div>
            </div>
            {(hasOpenInvoices || hasActiveOrders) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Ce compte a des {hasOpenInvoices ? "factures non soldées" : ""}{hasOpenInvoices && hasActiveOrders ? " et des " : ""}{hasActiveOrders ? "commandes actives" : ""}. La suppression est irréversible.
                </p>
              </div>
            )}
            <p className="text-sm text-gray-600 mb-5">
              Cette action supprimera définitivement le compte et ses contacts. Les factures et commandes liées seront conservées.
            </p>
            {deleteError && <p className="text-xs text-red-600 mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteError("") }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                disabled={deleting}
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? "Suppression..." : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4 flex-1">
          <button onClick={() => router.back()} className="mt-1 text-gray-400 hover:text-gray-600 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
            {hasOpenInvoices && (
              <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Factures ou commandes actives
              </p>
            )}
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span>{account.type === "government" ? "Gouvernement" : account.type === "enterprise" ? "Entreprise" : "PME"}</span>
              {account.industry && <span>· {account.industry}</span>}
              {account.city && <span>· {account.city}</span>}
              {account.salesperson && (
                <span className="flex items-center gap-1 text-blue-600">
                  <TrendingUp className="w-3 h-3" /> {account.salesperson.full_name}
                </span>
              )}
            </div>
            {(account.phone || account.email) && (
              <p className="text-xs text-gray-400 mt-0.5">
                {[account.phone, account.email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition"
        >
          <Trash2 className="w-4 h-4" />
          Supprimer
        </button>
      </div>

      {/* Period filter */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Période :</span>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${period === p.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {p.label}
            </button>
          ))}
          {period === "custom" && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-xs text-gray-400">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total commandé", value: fmtMulti(totalOrdered), icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50", sub: `${filteredOrders.length} commande${filteredOrders.length !== 1 ? "s" : ""}` },
          { label: "Total facturé", value: fmtMulti(totalInvoiced), icon: Receipt, color: "text-purple-600", bg: "bg-purple-50", sub: `${filteredInvoices.length} facture${filteredInvoices.length !== 1 ? "s" : ""}` },
          { label: "Total encaissé", value: fmtMulti(totalPaid), icon: Landmark, color: "text-emerald-600", bg: "bg-emerald-50", sub: "Paiements reçus" },
          { label: "Solde dû", value: fmtMulti(totalDue), icon: Clock, color: Object.values(totalDue).some(v => v > 0) ? "text-red-600" : "text-gray-400", bg: Object.values(totalDue).some(v => v > 0) ? "bg-red-50" : "bg-gray-50", sub: "En attente d'encaissement" },
        ].map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <p className={`text-sm font-bold leading-tight ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("factures")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${tab === "factures" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          Factures ({filteredInvoices.length})
        </button>
        <button
          onClick={() => setTab("devis")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${tab === "devis" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          Devis / Commandes ({filteredOrders.length})
        </button>
      </div>

      {/* Invoices table */}
      {tab === "factures" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {filteredInvoices.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-12">Aucune facture sur cette période</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Facture</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Échéance</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Encaissé</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 text-red-600">Solde dû</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{inv.number}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(inv.issue_date, "fr")}</td>
                    <td className="px-4 py-3 text-gray-600">{inv.due_date ? formatDate(inv.due_date, "fr") : "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={invoiceStatusColor[inv.status] ?? "gray"}>{invoiceStatusLabel[inv.status] ?? inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(inv.total, inv.currency as "GNF" | "USD" | "EUR")}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(inv.total_paid, inv.currency as "GNF" | "USD" | "EUR")}</td>
                    <td className={`px-4 py-3 text-right font-bold ${inv.balance > 0 ? "text-red-600" : "text-gray-300"}`}>
                      {inv.balance > 0 ? formatCurrency(inv.balance, inv.currency as "GNF" | "USD" | "EUR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/${locale}/ventes/factures/${inv.id}`} className="text-gray-300 hover:text-blue-500">
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={4} className="px-4 py-3 text-xs font-medium text-gray-500">Total période</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 text-xs">{fmtMulti(totalInvoiced)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 text-xs">{fmtMulti(totalPaid)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600 text-xs">{fmtMulti(totalDue)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* Orders table */}
      {tab === "devis" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {filteredOrders.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-12">Aucune commande sur cette période</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">N° Devis</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Commercial</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredOrders.map(o => (
                  <tr key={o.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{o.number || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(o.created_at, "fr")}</td>
                    <td className="px-4 py-3">
                      <Badge variant={orderStatusColor[o.status] ?? "gray"}>{orderStatusLabel[o.status] ?? o.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{o.salesperson?.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(o.total, o.currency as "GNF" | "USD" | "EUR")}</td>
                    <td className="px-4 py-3">
                      <Link href={`/${locale}/ventes/devis/${o.id}`} className="text-gray-300 hover:text-blue-500">
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={4} className="px-4 py-3 text-xs font-medium text-gray-500">Total période</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 text-xs">{fmtMulti(totalOrdered)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
