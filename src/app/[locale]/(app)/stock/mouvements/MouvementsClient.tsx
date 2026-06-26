"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Plus, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, SlidersHorizontal, Package, AlertTriangle, Skull, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { formatDate } from "@/lib/utils"

type MoveType = "in" | "out" | "transfer" | "adjustment" | "damaged" | "lost" | "destroyed"

interface MoveRow {
  id: string
  type: MoveType
  quantity: number
  created_at: string
  notes: string | null
  product: { id: string; name: string; reference: string | null; unit: { name: string } | null } | null
  from_warehouse: { id: string; name: string } | null
  to_warehouse: { id: string; name: string } | null
}

interface Props { moves: MoveRow[] }

const typeConfig: Record<MoveType, { label: string; labelEn: string; icon: React.ElementType; badge: "green" | "blue" | "purple" | "gray" | "yellow" | "red" }> = {
  in:         { label: "Entrée",       labelEn: "In",        icon: ArrowDownToLine,  badge: "green" },
  out:        { label: "Sortie",       labelEn: "Out",       icon: ArrowUpFromLine,  badge: "blue" },
  transfer:   { label: "Transfert",   labelEn: "Transfer",  icon: ArrowLeftRight,   badge: "purple" },
  adjustment: { label: "Ajustement",  labelEn: "Adjustment",icon: SlidersHorizontal,badge: "gray" },
  damaged:    { label: "Endommagé",   labelEn: "Damaged",   icon: AlertTriangle,    badge: "yellow" },
  lost:       { label: "Perdu",       labelEn: "Lost",      icon: Skull,            badge: "red" },
  destroyed:  { label: "Détruit/Rebus",labelEn: "Destroyed", icon: Trash2,          badge: "red" },
}

const ALL_TYPES = Object.keys(typeConfig) as MoveType[]

export default function MouvementsClient({ moves: initial }: Props) {
  const { locale } = useParams<{ locale: string }>()
  const [moves] = useState(initial)
  const [filterType, setFilterType] = useState<MoveType | "all">("all")

  const filtered = filterType === "all" ? moves : moves.filter(m => m.type === filterType)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mouvements de stock</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} mouvement{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href={`/${locale}/stock/mouvements/nouveau`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition"
        >
          <Plus className="w-4 h-4" />
          Nouveau mouvement
        </Link>
      </div>

      {/* Type filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterType("all")}
          className={`px-3 py-2 text-xs rounded-lg font-medium transition ${filterType === "all" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
        >
          Tous
        </button>
        {ALL_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-2 text-xs rounded-lg font-medium transition ${filterType === type ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {typeConfig[type].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucun mouvement enregistré</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Produit</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Qté</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">De</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vers</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(m => {
                const cfg = typeConfig[m.type]
                const Icon = cfg.icon
                return (
                  <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(m.created_at, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={cfg.badge}>
                        <Icon className="w-3 h-3 inline-block mr-1" />
                        {cfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{m.product?.name ?? "—"}</span>
                      {m.product?.reference && (
                        <span className="ml-2 font-mono text-xs text-gray-400">{m.product.reference}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {m.quantity.toLocaleString("fr")}
                      {m.product?.unit && <span className="text-gray-400 font-normal ml-1 text-xs">{m.product.unit.name}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.from_warehouse?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{m.to_warehouse?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{m.notes ?? "—"}</td>
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
