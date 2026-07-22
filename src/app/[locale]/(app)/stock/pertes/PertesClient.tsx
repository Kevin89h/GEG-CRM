"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertTriangle, Skull, Trash2, Plus, ArrowLeft } from "lucide-react"

interface Move {
  id: string
  type: string
  quantity: number
  notes: string | null
  created_at: string
  from_warehouse_id: string | null
  product: { name: string; reference: string | null } | null
  from_warehouse: { name: string } | null
}

interface ParsedNotes {
  motif?: string
  valeur_unitaire?: number
  commentaire?: string
}

function parseNotes(notes: string | null): ParsedNotes {
  if (!notes) return {}
  try {
    return JSON.parse(notes) as ParsedNotes
  } catch {
    return { commentaire: notes }
  }
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  damaged: { label: "Endommagé", icon: AlertTriangle, color: "text-yellow-700", bg: "bg-yellow-100" },
  lost: { label: "Perdu", icon: Skull, color: "text-red-700", bg: "bg-red-100" },
  destroyed: { label: "Détruit", icon: Trash2, color: "text-gray-700", bg: "bg-gray-100" },
}

type Period = "7" | "30" | "90" | "all"
type FilterType = "all" | "damaged" | "lost" | "destroyed"

export default function PertesClient({ moves }: { moves: Move[] }) {
  const { locale } = useParams<{ locale: string }>()
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [period, setPeriod] = useState<Period>("30")

  const cutoff = period === "all" ? null : new Date(Date.now() - parseInt(period) * 86400000)

  const filtered = moves.filter(m => {
    const matchType = filterType === "all" || m.type === filterType
    const matchPeriod = !cutoff || new Date(m.created_at) >= cutoff
    return matchType && matchPeriod
  })

  const kpi = {
    damaged: moves.filter(m => m.type === "damaged").reduce((s, m) => s + m.quantity, 0),
    lost: moves.filter(m => m.type === "lost").reduce((s, m) => s + m.quantity, 0),
    destroyed: moves.filter(m => m.type === "destroyed").reduce((s, m) => s + m.quantity, 0),
  }

  const totalValeur = filtered.reduce((s, m) => {
    const n = parseNotes(m.notes)
    return s + (n.valeur_unitaire ? n.valeur_unitaire * m.quantity : 0)
  }, 0)

  return (
    <div>
      <Link
        href={`/${locale}/stock`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Retour au stock
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
            Pertes & Rebuts
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Suivi des stocks endommagés, perdus ou détruits</p>
        </div>
        <Link
          href={`/${locale}/stock/mouvements/nouveau?type=damaged`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-yellow-500 text-white hover:bg-yellow-400 transition"
        >
          <Plus className="w-4 h-4" />
          Enregistrer une perte
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {(["damaged", "lost", "destroyed"] as const).map(key => {
          const cfg = TYPE_CONFIG[key]
          const Icon = cfg.icon
          return (
            <div key={key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <span className="text-sm font-medium text-gray-600">{cfg.label}</span>
              </div>
              <p className={`text-2xl font-bold ${cfg.color}`}>{kpi[key].toLocaleString("fr")}</p>
              <p className="text-xs text-gray-400 mt-0.5">unités (total historique)</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "damaged", "lost", "destroyed"] as FilterType[]).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                filterType === t ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t === "all" ? "Tous" : TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["7", "30", "90", "all"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                period === p ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p === "all" ? "Tout" : `${p}j`}
            </button>
          ))}
        </div>
        {totalValeur > 0 && (
          <div className="ml-auto text-sm text-gray-600">
            Valeur estimée perdue :{" "}
            <span className="font-bold text-red-600">{totalValeur.toLocaleString("fr")} GNF</span>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucune perte enregistrée</p>
          <p className="text-xs mt-1">Les pertes, casses et rebuts apparaîtront ici.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Produit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entrepôt</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Quantité</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Motif</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Valeur estimée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(m => {
                const cfg = TYPE_CONFIG[m.type]
                const Icon = cfg.icon
                const notes = parseNotes(m.notes)
                const valeur = notes.valeur_unitaire ? notes.valeur_unitaire * m.quantity : null
                return (
                  <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.product?.name ?? "—"}</p>
                      {m.product?.reference && (
                        <p className="text-xs text-gray-400 font-mono">{m.product.reference}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.from_warehouse?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{m.quantity.toLocaleString("fr")}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <span>{notes.motif ?? "—"}</span>
                      {notes.commentaire && (
                        <p className="text-xs text-gray-400 mt-0.5">{notes.commentaire}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                      {valeur != null ? `${valeur.toLocaleString("fr")} GNF` : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
