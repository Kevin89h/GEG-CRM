"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Truck, ArrowLeft, Package } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"

interface OrderLine {
  id: string
  description: string
  quantity: number
  qty_delivered: number
  product_id: string | null
  product: { name: string; reference: string | null } | null
  position: number
}

interface Warehouse {
  id: string
  name: string
}

interface Props {
  orderId: string
  orderNumber: string
  locale: string
  lines: OrderLine[]
  warehouses: Warehouse[]
}

export default function BLPartielClient({ orderId, orderNumber, locale, lines, warehouses }: Props) {
  const router = useRouter()
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "")
  const [notes, setNotes] = useState("")
  const [qtys, setQtys] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const l of lines) {
      init[l.id] = Math.max(0, l.quantity - l.qty_delivered)
    }
    return init
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleQtyChange = (lineId: string, value: string) => {
    const line = lines.find(l => l.id === lineId)
    if (!line) return
    const max = line.quantity - line.qty_delivered
    const parsed = Math.min(Math.max(0, Number(value) || 0), max)
    setQtys(prev => ({ ...prev, [lineId]: parsed }))
  }

  const handleSubmit = async () => {
    if (!warehouseId) {
      setError("Sélectionnez un entrepôt")
      return
    }

    const linesToDeliver = lines
      .filter(l => (qtys[l.id] ?? 0) > 0)
      .map(l => ({
        order_line_id: l.id,
        product_id: l.product_id ?? null,
        description: l.description,
        qty_to_deliver: qtys[l.id] ?? 0,
      }))

    if (linesToDeliver.length === 0) {
      setError("Aucune quantité à livrer")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/devis/${orderId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: linesToDeliver,
          warehouse_id: warehouseId,
          notes: notes || undefined,
          user_id: null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création du bon de livraison")
        return
      }

      router.push(`/${locale}/ventes/bons-livraison/${data.deliveryNoteId}`)
    } catch {
      setError("Erreur réseau, veuillez réessayer")
    } finally {
      setLoading(false)
    }
  }

  const totalToDeliver = Object.values(qtys).reduce((a, b) => a + b, 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/${locale}/ventes/devis/${orderId}`}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nouveau bon de livraison</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Commande {orderNumber}</p>
        </div>
      </div>

      {/* Warehouse selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1.5">Entrepôt de sortie</label>
        <select
          value={warehouseId}
          onChange={e => setWarehouseId(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Lines table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Description</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">Commandé</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">Déjà livré</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">Reliquat</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-36">Qté à livrer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {lines.map(line => {
              const remaining = line.quantity - line.qty_delivered
              const isFullyDelivered = remaining <= 0
              return (
                <tr
                  key={line.id}
                  className={isFullyDelivered ? "opacity-40" : ""}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      {line.product_id && (
                        <Package className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium">{line.description}</p>
                        {line.product?.reference && (
                          <p className="text-xs text-gray-400">{line.product.reference}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{line.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">{line.qty_delivered}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {isFullyDelivered ? (
                      <span className="text-green-600 dark:text-green-400 text-xs font-medium">Livré</span>
                    ) : (
                      remaining
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isFullyDelivered ? (
                      <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        step={1}
                        value={qtys[line.id] ?? 0}
                        onChange={e => handleQtyChange(line.id, e.target.value)}
                        className="w-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1.5">Notes (optionnel)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Remarques pour ce bon de livraison…"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {totalToDeliver > 0
            ? `${totalToDeliver} unité(s) à livrer`
            : "Aucune quantité saisie"}
        </p>
        <Button
          onClick={handleSubmit}
          disabled={loading || totalToDeliver === 0 || !warehouseId}
          className="flex items-center gap-2"
        >
          <Truck className="w-4 h-4" />
          {loading ? "Création…" : "Créer le bon de livraison"}
        </Button>
      </div>
    </div>
  )
}
