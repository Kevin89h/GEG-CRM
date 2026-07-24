"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, TrendingUp, CheckCircle2, DollarSign, Receipt } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

interface DealRow {
  id: string
  title: string
  stage?: string
  selling_price: number | null
  cost: number | null
  currency: string
  created_at: string
  account: { id: string; name: string } | null
  prospect_name: string | null
}

interface WonDealRow extends DealRow {
  invoice: { id: string; number: string; status: string; total_ht: number | null; currency: string } | null
}

interface Props {
  allDeals: DealRow[]
  wonDeals: WonDealRow[]
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  cancelled: "Annulée",
}

const INVOICE_STATUS_CLASS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-600",
  paid: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-500",
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function getMonthLabel(key: string) {
  const [year, month] = key.split("-")
  return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
}

export default function DealsDashboardClient({ allDeals, wonDeals }: Props) {
  const router = useRouter()
  const [currency] = useState<"USD" | "GNF" | "EUR">("USD")

  // Normalize invoice field (could be array from Supabase join)
  const normalizedWon: WonDealRow[] = wonDeals.map(d => ({
    ...d,
    invoice: Array.isArray(d.invoice) ? (d.invoice[0] ?? null) : d.invoice,
  }))

  const wonWithInvoice = normalizedWon.filter(d => d.invoice != null)

  const totalLeads = allDeals.length
  const totalWon = wonDeals.length

  const estimatedProfit = wonDeals.reduce((sum, d) => {
    const sp = d.selling_price ?? 0
    const cost = d.cost ?? 0
    return sum + (sp - cost)
  }, 0)

  const realizedProfit = wonWithInvoice.reduce((sum, d) => {
    return sum + (d.invoice?.total_ht ?? 0) - (d.cost ?? 0)
  }, 0)

  // Monthly chart: group won deals by month
  const monthlyMap = new Map<string, number>()
  for (const d of wonDeals) {
    const key = getMonthKey(d.created_at)
    const margin = (d.selling_price ?? 0) - (d.cost ?? 0)
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + margin)
  }
  const chartData = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([key, margin]) => ({ month: getMonthLabel(key), margin }))

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard Profit</h1>
          <p className="text-sm text-gray-500">Analyse financière des opportunités commerciales</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Total leads</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Deals gagnés</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalWon}</p>
          {totalLeads > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">Taux : {((totalWon / totalLeads) * 100).toFixed(0)}%</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Profit estimé</span>
          </div>
          <p className={`text-lg font-bold ${estimatedProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
            {formatCurrency(estimatedProfit, currency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Deals gagnés</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <Receipt className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Profit réalisé</span>
          </div>
          <p className={`text-lg font-bold ${realizedProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
            {formatCurrency(realizedProfit, currency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Sur factures liées</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Marge par mois (deals gagnés)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={v => v.toLocaleString("fr-FR", { notation: "compact" })} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [typeof value === "number" ? value.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " " + currency : String(value ?? ""), "Marge"]}
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
              />
              <Bar dataKey="margin" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Won deals table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Deals convertis ({totalWon})</h2>
        </div>
        {normalizedWon.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Aucun deal gagné pour le moment</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Titre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Client</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Prix vente</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Coût</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Marge</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Marge %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">N° Facture</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Statut facture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {normalizedWon.map(d => {
                  const sp = d.selling_price ?? 0
                  const cost = d.cost ?? 0
                  const margin = sp - cost
                  const marginPct = sp > 0 ? (margin / sp) * 100 : null
                  const clientName = d.account?.name ?? d.prospect_name ?? "—"
                  return (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <a href={`deals/${d.id}`} className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                          {d.title}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{clientName}</td>
                      <td className="px-4 py-3 text-right text-gray-800">
                        {d.selling_price != null ? formatCurrency(d.selling_price, d.currency as "USD" | "GNF" | "EUR") : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800">
                        {d.cost != null ? formatCurrency(d.cost, d.currency as "USD" | "GNF" | "EUR") : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {d.selling_price != null && d.cost != null ? (
                          <span className={margin >= 0 ? "text-green-600" : "text-red-600"}>
                            {formatCurrency(margin, d.currency as "USD" | "GNF" | "EUR")}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {marginPct != null ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${margin >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                            {marginPct.toFixed(1)}%
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {d.invoice ? (
                          <a href={`/fr/ventes/factures/${d.invoice.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                            {d.invoice.number}
                          </a>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {d.invoice ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${INVOICE_STATUS_CLASS[d.invoice.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {INVOICE_STATUS_LABEL[d.invoice.status] ?? d.invoice.status}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
