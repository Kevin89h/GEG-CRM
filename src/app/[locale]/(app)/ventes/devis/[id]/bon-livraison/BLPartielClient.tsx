"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Truck, ArrowLeft, Package, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { usePerms } from "@/components/PermissionsProvider"

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
  const { can } = usePerms()
  // Creating the delivery note needs "livraisons.creer" (D2, display only)
  const canCreate = can("livraisons.creer")
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
  // R4/H3: stock shortages returned by the server (409 = derogation possible, 403 = not allowed)
  const [shortages, setShortages] = useState<Shortage[] | null>(null)
  const [serverCanOverride, setServerCanOverride] = useState(false)
  const [derogationOpen, setDerogationOpen] = useState(false)
  const [derogationReason, setDerogationReason] = useState("")
  const [derogationConfirmed, setDerogationConfirmed] = useState(false)
  const [derogationError, setDerogationError] = useState<string | null>(null)
  const canOverride = serverCanOverride && can("stock.livraison_hors_stock")

  const handleQtyChange = (lineId: string, value: string) => {
    const line = lines.find(l => l.id === lineId)
    if (!line) return
    const max = line.quantity - line.qty_delivered
    const parsed = Math.min(Math.max(0, Number(value) || 0), max)
    setQtys(prev => ({ ...prev, [lineId]: parsed }))
    // The previous stock check no longer matches the edited quantities
    setShortages(null)
  }

  const openDerogation = () => {
    setDerogationReason("")
    setDerogationConfirmed(false)
    setDerogationError(null)
    setDerogationOpen(true)
  }

  const handleSubmit = async (derogation?: { reason: string; confirmed: true }) => {
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
    setDerogationError(null)

    try {
      const res = await fetch(`/api/devis/${orderId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: linesToDeliver,
          warehouse_id: warehouseId,
          notes: notes || undefined,
          user_id: null,
          ...(derogation ? { derogation } : {}),
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Stock shortage: detailed panel instead of a bare error
        if ((res.status === 409 || res.status === 403) && Array.isArray(data.shortages) && data.shortages.length > 0) {
          setShortages(data.shortages)
          setServerCanOverride(!!data.canOverride)
          if (derogation) setDerogationError(data.error ?? "La dérogation a été refusée")
          else setError(data.error ?? null)
        } else if (derogation) {
          setDerogationError(data.error ?? "Erreur lors de la création du bon de livraison")
        } else {
          setError(data.error ?? "Erreur lors de la création du bon de livraison")
        }
        return
      }

      setDerogationOpen(false)
      router.push(`/${locale}/ventes/bons-livraison/${data.deliveryNoteId}`)
    } catch {
      if (derogation) setDerogationError("Erreur réseau, veuillez réessayer")
      else setError("Erreur réseau, veuillez réessayer")
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
          onChange={e => { setWarehouseId(e.target.value); setShortages(null) }}
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

      {/* Stock insuffisant (R4/H3) */}
      {shortages && shortages.length > 0 && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-5 py-4 text-sm text-red-800 dark:text-red-300">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold">Stock insuffisant — livraison bloquée</p>
              {error && <p className="mt-0.5">{error}</p>}
            </div>
          </div>
          <ShortageTable shortages={shortages} />
          {canOverride ? (
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs">Vous pouvez exceptionnellement autoriser cette livraison (dérogation tracée).</p>
              <Button variant="danger" onClick={openDerogation} className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Livrer malgré le stock insuffisant
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-xs">
              La livraison est impossible tant que le stock est insuffisant. Réapprovisionnez le dépôt, changez d&apos;entrepôt ou de quantité,
              ou demandez à un Manager (droit « livraison hors stock ») de l&apos;autoriser.
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && !(shortages && shortages.length > 0) && (
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
        {canCreate ? (
          <Button
            onClick={() => handleSubmit()}
            disabled={loading || totalToDeliver === 0 || !warehouseId}
            className="flex items-center gap-2"
          >
            <Truck className="w-4 h-4" />
            {loading ? "Création…" : "Créer le bon de livraison"}
          </Button>
        ) : (
          <p className="text-sm text-gray-400">Vous n&apos;avez pas le droit de créer un bon de livraison.</p>
        )}
      </div>

      {/* Modal dérogation : livraison au-delà du stock disponible */}
      <Modal open={derogationOpen && canOverride && !!shortages} onClose={() => setDerogationOpen(false)} title="Livrer malgré le stock insuffisant" className="max-w-2xl">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold mb-1">Attention : livraison au-delà du stock disponible</p>
              <p>
                Le stock des produits ci-dessous deviendra négatif. Cette dérogation est exceptionnelle,
                enregistrée avec votre nom et votre justification dans le journal d&apos;audit.
              </p>
            </div>
          </div>
          {shortages && <ShortageTable shortages={shortages} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Justification (obligatoire, 10 caractères minimum)</label>
            <textarea
              value={derogationReason}
              onChange={e => setDerogationReason(e.target.value)}
              rows={3}
              placeholder="Ex : marchandise physiquement présente, réception fournisseur pas encore saisie…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <p className={`text-xs mt-1 ${derogationReason.trim().length >= 10 ? "text-gray-400" : "text-red-500"}`}>
              {derogationReason.trim().length} / 10 caractères minimum
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
            <input
              type="checkbox"
              checked={derogationConfirmed}
              onChange={e => setDerogationConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            Je confirme cette livraison au-delà du stock disponible
          </label>
          {derogationError && <p className="text-sm text-red-600">{derogationError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDerogationOpen(false)}>Annuler</Button>
            <Button
              variant="danger"
              onClick={() => handleSubmit({ reason: derogationReason.trim(), confirmed: true })}
              disabled={loading || derogationReason.trim().length < 10 || !derogationConfirmed}
            >
              {loading ? "Création…" : "Livrer malgré le stock insuffisant"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

interface Shortage { product_id?: string; product: string; warehouse_id?: string; warehouse: string; requested: number; available: number; missing: number; result: number }

// Shortage detail per product and warehouse; the resulting stock is shown even when negative
function ShortageTable({ shortages }: { shortages: Shortage[] }) {
  const fmt = (n: number) => Number(n).toLocaleString("fr")
  return (
    <div className="overflow-x-auto rounded-lg border border-red-200 bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-red-50 text-red-800">
            <th className="text-left px-3 py-2 font-medium">Produit</th>
            <th className="text-left px-3 py-2 font-medium">Dépôt</th>
            <th className="text-right px-3 py-2 font-medium">Qté à livrer</th>
            <th className="text-right px-3 py-2 font-medium">Stock disponible</th>
            <th className="text-right px-3 py-2 font-medium">Manquant</th>
            <th className="text-right px-3 py-2 font-medium">Stock résultant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-red-100">
          {shortages.map((s, i) => (
            <tr key={`${s.product_id ?? s.product}-${s.warehouse_id ?? s.warehouse}-${i}`}>
              <td className="px-3 py-2 font-medium text-gray-900">{s.product}</td>
              <td className="px-3 py-2 text-gray-700">{s.warehouse}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-900">{fmt(s.requested)}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${s.available < 0 ? "text-red-600 font-semibold" : "text-gray-900"}`}>{fmt(s.available)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-red-600 font-semibold">{fmt(s.missing)}</td>
              <td className={`px-3 py-2 text-right tabular-nums font-semibold ${s.result < 0 ? "text-red-600" : "text-gray-900"}`}>{fmt(s.result)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
