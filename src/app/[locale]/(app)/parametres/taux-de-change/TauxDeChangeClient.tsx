"use client"

import { useState } from "react"
import { Plus, TrendingUp, RefreshCw } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { usePerms } from "@/components/PermissionsProvider"
import { formatRate, ageInDays, rateOrigin, DOC_RATES_STALE_DAYS, docPairsFor } from "@/lib/document-rates-shared"

interface Rate {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  effective_date: string
  notes: string | null
  created_at?: string | null
}

interface Props {
  rates: Rate[]
  /** active company: each one has its own pairs (D-10) */
  schema?: string
}

type Currency = string
const NAMES: Record<string, string> = { USD: "Dollar", EUR: "Euro", GNF: "Franc guinéen", XOF: "Franc CFA", SGD: "Dollar de Singapour" }

export default function TauxDeChangeClient({ rates: initialRates, schema }: Props) {
  // pairs and currencies of the active company (Guinée : GNF, USD, EUR, XOF — Singapour : EUR, USD)
  const PAIRS = docPairsFor(schema).map(p => ({ ...p, label: `${NAMES[p.from] ?? p.from} → ${NAMES[p.to] ?? p.to}` }))
  const CURRENCIES = [...new Set(PAIRS.flatMap(p => [p.from, p.to]))]
  const { can } = usePerms()
  // Display only (D2): refreshing and adding rates need "parametres.gerer"
  const canManage = can("parametres.gerer")
  const [rates, setRates] = useState(initialRates)
  const [form, setForm] = useState({ from: PAIRS[0]?.from ?? "USD", to: PAIRS[0]?.to ?? "EUR", rate: "", notes: "", date: new Date().toISOString().slice(0, 10) })
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
    setRefreshMsg(`${json.updated} taux de référence ajoutés le ${new Date().toLocaleDateString("fr")} (open.er-api.com). Les taux déjà appliqués aux documents et paiements ne changent pas.`)
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

  const newest = (a: Rate, b: Rate) => b.effective_date.localeCompare(a.effective_date) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
  // D-08: last refresh (any origin) and alert when the reference rates are old
  const lastRate = [...rates].sort(newest)[0]
  const lastAge = lastRate ? ageInDays(lastRate.effective_date) : null
  const lastAuto = [...rates].filter(r => /quotidienne/i.test(r.notes ?? "")).sort(newest)[0]
  const latestByPair = PAIRS.map(p => {
    const key = `${p.from}_${p.to}`
    const latest = (byPair[key] ?? []).sort(newest)[0]
    return { ...p, latest }
  })

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">Gérez les taux de change de cette société ({CURRENCIES.join(", ")}) pour les achats et les paiements en devise</p>
        {canManage && (
          <button
            onClick={refreshRates}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Mise à jour…" : "Actualiser les taux"}
          </button>
        )}
      </div>
      {refreshMsg && <p className="text-sm text-emerald-600 mb-4">{refreshMsg}</p>}

      {/* D-08: date and source of the last refresh, alert when old */}
      <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${lastAge !== null && lastAge <= DOC_RATES_STALE_DAYS ? "border-gray-100 bg-white text-gray-600" : "border-amber-200 bg-amber-50 text-amber-800"}`} data-testid="rates-status">
        {lastRate ? (
          <p>{lastAge !== null && lastAge > DOC_RATES_STALE_DAYS ? <strong>⚠ Taux anciens : </strong> : null}Dernière actualisation : <strong>{formatDate(lastRate.effective_date, "fr")}</strong> ({rateOrigin(lastRate.notes)}){lastAge !== null && lastAge > DOC_RATES_STALE_DAYS ? ` — il y a ${lastAge} jours. Ces derniers taux restent proposés ; actualisez-les ou saisissez le taux appliqué.` : "."}</p>
        ) : <p><strong>⚠ Aucun taux de référence enregistré.</strong></p>}
        <p className="mt-1 text-xs text-gray-500">Source : open.er-api.com (ExchangeRate-API). Actualisation automatique chaque jour vers 5 h (UTC){lastAuto ? `, dernière le ${formatDate(lastAuto.effective_date, "fr")}` : ""} ; bouton d&apos;actualisation manuelle conservé. Ces taux sont proposés pour les <strong>nouvelles</strong> opérations ; un taux bancaire ou contractuel peut toujours être saisi, et les taux déjà appliqués aux documents et paiements ne sont jamais recalculés.</p>
      </div>

      {/* Current rates */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {latestByPair.map(({ from, to, label, latest }) => (
          <div key={`${from}_${to}`} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-400 font-medium mb-2">{label}</p>
            {latest ? (
              <>
                <p className="text-2xl font-bold text-gray-900">
                  1 {from} = <span className="text-blue-600">{formatRate(latest.rate)} {to}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Depuis le {formatDate(latest.effective_date, "fr")} · {rateOrigin(latest.notes)}</p>
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
      {canManage && <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8">
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
      </div>}

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
              {[...rates].sort(newest).map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.from_currency} → {r.to_currency}</td>
                  <td className="px-4 py-3 text-right text-blue-700 font-semibold">
                    {formatRate(r.rate)} {r.to_currency}
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
