"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Save, Search, CheckCircle, AlertTriangle } from "lucide-react"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { useParams } from "next/navigation"

interface Product {
  id: string
  name: string
  reference: string | null
  unit: { name: string } | null
}

interface Warehouse {
  id: string
  name: string
}

interface Level {
  product_id: string
  warehouse_id: string
  quantity: number
}

interface Props {
  products: Product[]
  warehouses: Warehouse[]
  levels: Level[]
}

export default function InventaireClient({ products, warehouses, levels }: Props) {
  const router = useRouter()
  const params = useParams()

  // Build initial map: productId -> warehouseId -> quantity
  const initialMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const p of products) map[p.id] = {}
    for (const l of levels) {
      if (!map[l.product_id]) map[l.product_id] = {}
      map[l.product_id][l.warehouse_id] = l.quantity
    }
    return map
  }, [products, levels])

  const [values, setValues] = useState<Record<string, Record<string, string>>>(() => {
    const map: Record<string, Record<string, string>> = {}
    for (const p of products) {
      map[p.id] = {}
      for (const w of warehouses) {
        map[p.id][w.id] = String(initialMap[p.id]?.[w.id] ?? 0)
      }
    }
    return map
  })

  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() =>
    products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.reference ?? "").toLowerCase().includes(search.toLowerCase())
    ), [products, search])

  // Count modified cells
  const changedCount = useMemo(() => {
    let count = 0
    for (const p of products) {
      for (const w of warehouses) {
        const newVal = parseFloat(values[p.id]?.[w.id] ?? "0") || 0
        const oldVal = initialMap[p.id]?.[w.id] ?? 0
        if (newVal !== oldVal) count++
      }
    }
    return count
  }, [values, products, warehouses, initialMap])

  function setValue(productId: string, warehouseId: string, val: string) {
    setValues(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [warehouseId]: val },
    }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const { supabase } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError("Non authentifié"); setSaving(false); return }

    const adjustments: { product_id: string; warehouse_id: string; newQuantity: number; currentQuantity: number }[] = []
    for (const p of products) {
      for (const w of warehouses) {
        const newQty = parseFloat(values[p.id]?.[w.id] ?? "0") || 0
        const oldQty = initialMap[p.id]?.[w.id] ?? 0
        if (newQty !== oldQty) {
          adjustments.push({ product_id: p.id, warehouse_id: w.id, newQuantity: newQty, currentQuantity: oldQty })
        }
      }
    }

    if (adjustments.length === 0) {
      setSaving(false)
      setSaved(true)
      return
    }

    const res = await fetch("/api/inventaire/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adjustments, user_id: user.id }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? "Erreur lors de la sauvegarde")
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
    router.refresh()
    const locale = params.locale as string
    setTimeout(() => router.push(`/${locale}/stock`), 1200)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ajustement inventaire</h1>
          <p className="text-gray-500 text-sm mt-0.5">Modifiez les quantités directement dans le tableau puis enregistrez</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || changedCount === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Enregistré !" : saving ? "Enregistrement..." : `Enregistrer${changedCount > 0 ? ` (${changedCount} modif.)` : ""}`}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[240px]">Produit</th>
              {warehouses.map(w => (
                <th key={w.id} className="text-center px-4 py-3 font-medium text-gray-600 min-w-[120px]">{w.name}</th>
              ))}
              <th className="text-right px-4 py-3 font-medium text-gray-600 min-w-[80px]">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(p => {
              const total = warehouses.reduce((s, w) => s + (parseFloat(values[p.id]?.[w.id] ?? "0") || 0), 0)
              const hasChange = warehouses.some(w => {
                const newVal = parseFloat(values[p.id]?.[w.id] ?? "0") || 0
                return newVal !== (initialMap[p.id]?.[w.id] ?? 0)
              })
              return (
                <tr key={p.id} className={`hover:bg-blue-50/20 transition-colors ${hasChange ? "bg-amber-50/40" : ""}`}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    {p.reference && <span className="ml-2 text-xs text-gray-400 font-mono">{p.reference}</span>}
                    {p.unit && <span className="ml-2 text-xs text-gray-500">({p.unit.name})</span>}
                  </td>
                  {warehouses.map(w => {
                    const original = initialMap[p.id]?.[w.id] ?? 0
                    const current = parseFloat(values[p.id]?.[w.id] ?? "0") || 0
                    const changed = current !== original
                    return (
                      <td key={w.id} className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={values[p.id]?.[w.id] ?? "0"}
                          onChange={e => setValue(p.id, w.id, e.target.value)}
                          className={`w-24 px-2 py-1.5 text-sm text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                            changed
                              ? "border-amber-400 bg-amber-50 text-amber-900 font-semibold"
                              : "border-gray-200 bg-white text-gray-700"
                          }`}
                        />
                        {changed && (
                          <div className="text-[10px] text-amber-600 mt-0.5">était {original}</div>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                    {total.toLocaleString("fr")}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
