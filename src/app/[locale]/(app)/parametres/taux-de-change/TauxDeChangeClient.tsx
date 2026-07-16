"use client"

import { useState } from "react"
import { Plus, TrendingUp, RefreshCw } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface Rate {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  effective_date: string
  notes: string | null
}

interface Props {
  rates: Rate[]
}

const CURRENCIES = ["USD", "EUR", "GNF", "XOF"] as const
type Currency = typeof CURRENCIES[number]

const PAIRS: { from: Currency; to: Currency; label: string }[] = [
  { from: "USD", to: "GNF", label: "Dollar → Franc guinéen" },
  { from: "EUR", to: "GNF", label: "Euro → Franc guinéen" },
  { from: "XOF", to: "GNF", label: "Franc CFA → Franc guinéen" },
  { from: "EUR", to: "USD", label: "Euro → Dollar" },
  { from: "USD", to: "EUR", label: "Dollar → Euro" },
  { from: "XOF", to: "USD", label: "Franc CFA → Dollar" },
  { from: "XOF", to: "EUR", label: "Franc CFA → Euro" },
]

export default function TauxDeChangeClient({ rates: initialRates }: Props) {
  const [rates, setRates] = useState(initialRates)
  const [form, setForm] = useState({ from: "USD" as Currency, to: "GNF" as Currency, rate: "", notes: "", date: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)

  async function refreshRates() {
    setRefreshing(true)
    setRefreshMsg(null)
    setError(null)
    const res = await fetch("/api/exchange-rates/refresh", { method: "POST" })
    const json = await res.json()
    setRefreshing(false)
    if (!res.ok) { setError(json.error ?? "Erreur de mise à jour"); return }
    const newRates = json.rates as Rate[]
    setRates(prev => {
      const updated = [...prev]
      for (const r of newRates) {
        updated.unshift({ ...r, id: `tmp-${r.from_currency}-${r.to_currency}` })
      }
      return updated
    })
    setRefreshMsg(`${json.updated} taux mis à jour le ${new Date().toLocaleDateString("fr")}`)
  }

  // Group by pair, latest first
  const byPair: Record<string, Rate[]> = {}
  for (const r of rates) {
    const key = `${r.from_currency}_${r.to_currency}`
    if (!byPair[key]) byPair[key] = []
    byPair[key].push(r)
  }

  async function addRate() {
    if (!form.rate || form.from === form.to) return
    setSaving(true)
    setError(null)
    const res = await fetch("/api/parametres/taux-de-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_currency: form.from,
        to_currency: form.to,
        rate: parseFloat(form.rate),
        effective_date: form.date,
        notes: form.notes || null,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? "Erreur lors de l'enregistrement du taux")
      setSaving(false)
      return
    }
    setRates(prev => [json as Rate, ...prev].sort((a, b) => b.effective_date.localeCompare(a.effective_date)))
    setForm(f => ({ ...f, rate: "", notes: "" }))
    setSaving(false)
  }

  const latestByPair = PAIRS.map(p => {
    const key = `${p.from}_${p.to}`
    const latest = (byPair[key] ?? []).sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0]
    return { ...p, latest }
  })

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">Gérez les taux de change (USD, EUR, XOF ↔ GNF) pour les calculs de prix de revient</p>
        <button
          onClick={refreshRates}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Mise à jour…" : "Actualiser les taux"}
        </button>
      </div>
      {refreshMsg && <p className="text-sm text-emerald-600 mb-4">{refreshMsg}</p>}

      {/* Current rates */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {latestByPair.map(({ from, to, label, latest }) => (
          <div key={`${from}_${to}`} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-400 font-medium mb-2">{label}</p>
            {latest ? (
              <>
                <p className="text-2xl font-bold text-gray-900">
                  1 {from} = <span className="text-blue-600">{latest.rate.toLocaleString("fr", { maximumFractionDigits: 4 })} {to}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Depuis le {formatDate(latest.effective_date, "fr")}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">Aucun taux enregistré</p>
            )}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add rate form */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8">
        <h2 className="font-semibold text-gray-800 mb-4">Ajouter un taux</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Devise source</label>
            <select
              value={form.from}
              onChange={e => setForm(f => ({ ...f, from: e.target.value as Currency }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Devise cible</label>
            <select
              value={form.to}
              onChange={e => setForm(f => ({ ...f, to: e.target.value as Currency }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {CURRENCIES.filter(c => c !== form.from).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              1 {form.from} =
            </label>
            <input
              type="number" min="0" step="any"
              value={form.rate}
              onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
              placeholder={`ex: 8600`}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date d'effet</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optionnel"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}
        <button
          onClick={addRate}
          disabled={!form.rate || saving || form.from === form.to}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          {saving ? "Enregistrement…" : "Ajouter le taux"}
        </button>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-800">Historique des taux</h2>
        </div>
        {rates.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">Aucun taux enregistré</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Paire</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Taux</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date d'effet</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...rates].sort((a, b) => b.effective_date.localeCompare(a.effective_date)).map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.from_currency} → {r.to_currency}</td>
                  <td className="px-4 py-3 text-right text-blue-700 font-semibold">
                    {r.rate.toLocaleString("fr", { maximumFractionDigits: 4 })} {r.to_currency}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(r.effective_date, "fr")}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{r.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
