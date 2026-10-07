"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { TrendingUp, ShoppingBag, ArrowUpRight, Layers, ChevronRight, BarChart3, RefreshCw } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface SalesOrder {
  id: string
  number: string
  status: string
  currency: string
  date_order: string | null
  project_code: string | null
  commission_client: number | null
  account: { name: string } | null
  salesperson: { full_name: string } | null
}

interface PurchaseOrder {
  id: string
  number: string
  status: string
  currency: string
  order_date: string | null
  project_code: string | null
  supplier_name: string
  freight_cost: number | null
  insurance_cost: number | null
}

interface Project {
  code: string
  label: string
  devis: SalesOrder[]
  achats: PurchaseOrder[]
  ca_ht: number
  encaisse: number
  cout_achat: number
  marge: number
}

const STATUS_COLORS: Record<string, string> = {
  draft:      "bg-gray-100 text-gray-600",
  sent:       "bg-amber-100 text-amber-700",
  confirmed:  "bg-blue-100 text-blue-700",
  invoiced:   "bg-purple-100 text-purple-700",
  done:       "bg-emerald-100 text-emerald-700",
  cancelled:  "bg-red-100 text-red-600",
  in_transit: "bg-sky-100 text-sky-700",
  received:   "bg-emerald-100 text-emerald-700",
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyé", confirmed: "Confirmé",
  invoiced: "Facturé", done: "Terminé", cancelled: "Annulé",
  in_transit: "En transit", received: "Reçu",
}

function fmt(n: number, currency = "GNF") {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Md ${currency}`
  if (Math.abs(n) >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)} M ${currency}`
  if (Math.abs(n) >= 1_000)         return `${(n / 1_000).toFixed(0)} k ${currency}`
  return `${n.toFixed(0)} ${currency}`
}

function MargeBar({ ca, cout }: { ca: number; cout: number }) {
  if (ca <= 0) return null
  const pct = Math.min(100, Math.max(0, (cout / ca) * 100))
  const marge = ca - cout
  const margePct = ((marge / ca) * 100).toFixed(1)
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>Coût / CA HT</span>
        <span className={marge >= 0 ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>
          {marge >= 0 ? "+" : ""}{margePct}% de marge
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${marge >= 0 ? "bg-emerald-400" : "bg-red-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function ProjetsClient() {
  const params = useParams()
  const locale = (params?.locale as string) ?? "fr"

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<"devis" | "achats">("devis")

  useEffect(() => {
    fetch("/api/projets")
      .then(r => r.json())
      .then(d => { setProjects(d.projects ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const activeProject = projects.find(p => p.code === selected)
  const totalCA    = projects.reduce((s, p) => s + p.ca_ht, 0)
  const totalCout  = projects.reduce((s, p) => s + p.cout_achat, 0)
  const totalMarge = totalCA - totalCout

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto pb-16">

      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Layers className="w-6 h-6 text-blue-600" /> Projets
        </h1>
        <p className="text-sm text-gray-500 mt-1">Agrégation Ventes · Achats par projet</p>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "CA HT cumulé",    value: fmt(totalCA),    color: "text-blue-700",    bg: "bg-blue-50",    icon: TrendingUp },
          { label: "Coût achats",     value: fmt(totalCout),  color: "text-orange-700",  bg: "bg-orange-50",  icon: ShoppingBag },
          { label: "Marge brute",     value: fmt(totalMarge), color: totalMarge >= 0 ? "text-emerald-700" : "text-red-600", bg: totalMarge >= 0 ? "bg-emerald-50" : "bg-red-50", icon: BarChart3 },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`${bg} rounded-xl p-4 border border-white`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">

        {/* Liste projets */}
        <div className="col-span-4 space-y-3">
          {projects.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Aucun projet avec code renseigné.<br />
              Assignez un projet sur les devis et bons de commande.
            </div>
          )}
          {projects.map(p => (
            <button
              key={p.code}
              onClick={() => { setSelected(p.code === selected ? null : p.code); setTab("devis") }}
              className={`w-full text-left rounded-xl border p-4 transition-all ${
                selected === p.code
                  ? "border-blue-300 bg-blue-50 shadow-sm"
                  : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{p.code}</span>
                  <h3 className="font-semibold text-gray-900 leading-tight">{p.label}</h3>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${selected === p.code ? "rotate-90" : ""}`} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                  <p className="text-gray-400">Devis</p>
                  <p className="font-semibold text-gray-800">{p.devis.length} · {fmt(p.ca_ht)}</p>
                </div>
                <div className="bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                  <p className="text-gray-400">Achats</p>
                  <p className="font-semibold text-gray-800">{p.achats.length} · {fmt(p.cout_achat)}</p>
                </div>
              </div>

              <MargeBar ca={p.ca_ht} cout={p.cout_achat} />
            </button>
          ))}
        </div>

        {/* Détail projet */}
        <div className="col-span-8">
          {!activeProject ? (
            <div className="flex items-center justify-center h-full min-h-[300px] rounded-2xl border-2 border-dashed border-gray-100 text-gray-400 text-sm">
              Sélectionnez un projet pour voir le détail
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

              {/* En-tête projet */}
              <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">{activeProject.code}</span>
                    <h2 className="text-xl font-bold text-gray-900">{activeProject.label}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Marge brute estimée</p>
                    <p className={`text-2xl font-black ${activeProject.marge >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {activeProject.marge >= 0 ? "+" : ""}{fmt(activeProject.marge)}
                    </p>
                    {activeProject.ca_ht > 0 && (
                      <p className="text-xs text-gray-400">
                        sur {fmt(activeProject.ca_ht)} CA HT
                      </p>
                    )}
                  </div>
                </div>

                {/* Barre marge détaillée */}
                <div className="mt-4">
                  <MargeBar ca={activeProject.ca_ht} cout={activeProject.cout_achat} />
                </div>

                {/* KPIs projet */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: "CA HT",      value: fmt(activeProject.ca_ht),    color: "text-blue-700" },
                    { label: "Encaissé",   value: fmt(activeProject.encaisse), color: "text-purple-700" },
                    { label: "Coût achat", value: fmt(activeProject.cout_achat), color: "text-orange-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white rounded-lg px-3 py-2 border border-gray-100 text-center">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className={`font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Onglets Devis / Achats */}
              <div className="flex border-b border-gray-100 px-6">
                {(["devis", "achats"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`mr-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t === "devis" ? `Devis (${activeProject.devis.length})` : `Achats (${activeProject.achats.length})`}
                  </button>
                ))}
              </div>

              {/* Table Devis */}
              {tab === "devis" && (
                <div className="divide-y divide-gray-50">
                  {activeProject.devis.length === 0 ? (
                    <p className="text-center py-8 text-sm text-gray-400">Aucun devis pour ce projet</p>
                  ) : activeProject.devis.map(so => (
                    <div key={so.id} className="px-6 py-3 flex items-center gap-4 hover:bg-gray-50/60 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-semibold text-gray-700">{so.number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[so.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABELS[so.status] ?? so.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {so.account?.name ?? "—"}{so.salesperson ? ` · ${so.salesperson.full_name}` : ""}
                        </p>
                      </div>
                      <div className="text-right text-sm shrink-0">
                        <p className="font-semibold text-gray-800">
                          {so.currency}
                          {so.commission_client != null && (
                            <span className="ml-2 text-xs text-gray-400">comm. {so.commission_client}%</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">{so.date_order ?? "—"}</p>
                      </div>
                      <Link
                        href={`/${locale}/ventes/devis/${so.id}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 shrink-0"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {/* Table Achats */}
              {tab === "achats" && (
                <div className="divide-y divide-gray-50">
                  {activeProject.achats.length === 0 ? (
                    <p className="text-center py-8 text-sm text-gray-400">Aucun achat pour ce projet</p>
                  ) : activeProject.achats.map(po => (
                    <div key={po.id} className="px-6 py-3 flex items-center gap-4 hover:bg-gray-50/60 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-semibold text-gray-700">{po.number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[po.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABELS[po.status] ?? po.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {po.supplier_name}
                          {(po.freight_cost || po.insurance_cost) ? ` · Fret+Ass. incl.` : ""}
                        </p>
                      </div>
                      <div className="text-right text-sm shrink-0">
                        <p className="font-semibold text-gray-800">{po.currency}</p>
                        <p className="text-xs text-gray-400">{po.order_date ?? "—"}</p>
                      </div>
                      <Link
                        href={`/${locale}/achats/${po.id}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 shrink-0"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
