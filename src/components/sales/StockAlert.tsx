"use client"

// Non-blocking stock alerts for quote and invoice lines (R3/H2). Quotes and invoices have no warehouse:
// the stock is shown PER WAREHOUSE, never as if the global total were available in a single place.
// Services are never checked (R5). The user can always continue.
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { formatNumber } from "@/lib/utils"

export interface Availability {
  name: string
  service: boolean
  total: number
  warehouses: { id: string; name: string; quantity: number }[]
}

interface StockAlertProps {
  lines: { product_id: string | null | undefined; quantity: number | string }[]
  /** Optional: receives the availability data once loaded (e.g. to flag services in a table) */
  onAvailability?: (data: Record<string, Availability>) => void
  className?: string
}

export default function StockAlert({ lines, onAvailability, className = "" }: StockAlertProps) {
  const [data, setData] = useState<Record<string, Availability>>({})

  // Requested quantity per product (several lines of the same product are added up)
  const requested = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of lines) {
      if (!l.product_id) continue
      const q = typeof l.quantity === "number" ? l.quantity : parseFloat(l.quantity) || 0
      m.set(l.product_id, (m.get(l.product_id) ?? 0) + q)
    }
    return m
  }, [lines])

  const idsKey = useMemo(() => [...requested.keys()].sort().join(","), [requested])

  useEffect(() => {
    // No product: nothing to fetch (alerts are computed from the requested lines, so stale data shows nothing)
    if (!idsKey) return
    const ctrl = new AbortController()
    fetch(`/api/stock/disponibilite?ids=${encodeURIComponent(idsKey)}`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : { products: {} }))
      .then(json => {
        const products = (json.products ?? {}) as Record<string, Availability>
        setData(products)
        onAvailability?.(products)
      })
      // Without "stock.voir" (403) or on network error: no alert, the document can still be saved
      .catch(() => {})
    return () => ctrl.abort()
    // onAvailability is a callback prop: refetch only when the set of products changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const alerts = [...requested.entries()].flatMap(([id, qty]) => {
    const a = data[id]
    if (!a || a.service || qty <= 0) return []
    const maxOne = a.warehouses.reduce((m, w) => Math.max(m, w.quantity), 0)
    if (qty <= maxOne) return []
    return [{ id, a, qty, short: qty > a.total }]
  })

  if (alerts.length === 0) return null

  return (
    <div className={`space-y-2 ${className}`}>
      {alerts.map(({ id, a, qty, short }) => {
        const stocked = a.warehouses.filter(w => w.quantity > 0)
        return (
          <div key={id} className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <div className="space-y-0.5">
              <p className="font-semibold">
                {short ? "Stock insuffisant" : "Aucun dépôt ne couvre seul la quantité"} — {a.name}
              </p>
              <p>
                Quantité demandée : <strong>{formatNumber(qty)}</strong>
                {short && <> · Manquant : <strong>{formatNumber(qty - a.total)}</strong> (stock cumulé de tous les dépôts : {formatNumber(a.total)})</>}
              </p>
              <p>
                Disponible : {stocked.length > 0
                  ? stocked.map(w => `${w.name} ${formatNumber(w.quantity)}`).join(" · ")
                  : "aucun stock dans aucun dépôt"} (aucun dépôt choisi à ce stade)
              </p>
              <p className="text-xs text-amber-700">Alerte non bloquante : vous pouvez poursuivre. Le dépôt sera choisi à la livraison.</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
