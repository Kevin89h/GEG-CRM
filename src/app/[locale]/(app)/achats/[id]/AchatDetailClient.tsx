"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Truck, Trash2, Plus, ArrowRight, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatCurrency } from "@/lib/utils"
import DocumentLayout from "@/components/print/DocumentLayout"

interface LandedLine {
  line_id: string
  product_id: string | null
  description: string
  quantity: number
  fob_unit_price: number
  fob_total: number
  allocated_costs: number
  landed_total: number
  landed_unit_price: number
  warehouse_id: string | null
}

interface Cost {
  id: string
  type: string
  label: string
  amount: number
  currency: string
}

interface Order {
  id: string
  number: string
  status: string
  supplier_name: string
  currency: string
  incoterm: string
  order_date: string
  expected_date: string | null
  notes: string | null
  freight_cost: number
  insurance_cost: number
  global_discount_pct: number
}

interface Warehouse { id: string; name: string; city: string | null }
interface ExchangeRate { from_currency: string; to_currency: string; rate: number; effective_date: string }

interface Props {
  order: Order
  lines: LandedLine[]
  costs: Cost[]
  warehouses: Warehouse[]
  exchangeRates: ExchangeRate[]
  locale: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docSettings?: Record<string, any>
}

const costTypeLabel: Record<string, string> = {
  transport_maritime: "Transport maritime",
  transport_routier: "Transport routier",
  douane: "Droits de douane",
  tva_avance: "Avance TVA",
  transport_entrepot: "Transport → entrepôt",
  dechargement: "Frais de déchargement",
  autre: "Autre",
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-600" },
  received: { label: "Réceptionné", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-600" },
}

function getRate(rates: ExchangeRate[], from: string, to: string): number | null {
  if (from === to) return 1
  // Find most recent rate
  const match = rates
    .filter(r => r.from_currency === from && r.to_currency === to)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0]
  return match?.rate ?? null
}

export default function AchatDetailClient({ order, lines: initialLines, costs: initialCosts, warehouses, exchangeRates, locale, docSettings = {} }: Props) {
  const router = useRouter()
  const [lines, setLines] = useState(initialLines)
  const [costs, setCosts] = useState(initialCosts)
  const [saving, setSaving] = useState(false)
  const [newCost, setNewCost] = useState({ type: "transport_maritime", label: "Transport maritime", amount: "", currency: order.currency })

  const isDraft = order.status === "draft"
  const cur = order.currency as "USD" | "GNF" | "EUR"

  const totalFOB = lines.reduce((s, l) => s + l.fob_total, 0)
  const discountAmt = totalFOB * (order.global_discount_pct / 100)
  const totalAfterDiscount = totalFOB - discountAmt
  const totalCosts = costs.reduce((s, c) => s + c.amount, 0)
  const totalLanded = totalAfterDiscount + totalCosts

  // GNF conversion
  const rateToGNF = getRate(exchangeRates, order.currency, "GNF")
  const showGNF = order.currency !== "GNF" && rateToGNF !== null

  function updateWarehouse(lineId: string, warehouseId: string) {
    setLines(prev => prev.map(l => l.line_id === lineId ? { ...l, warehouse_id: warehouseId } : l))
  }

  async function addCost() {
    if (!newCost.amount) return
    const { supabase, db } = getCompanyClientBrowser()
    const { data } = await db.from("purchase_costs").insert([{
      order_id: order.id,
      type: newCost.type,
      label: newCost.label,
      amount: parseFloat(newCost.amount),
      currency: newCost.currency,
    }]).select("*").single()
    if (data) {
      setCosts(prev => [...prev, data as Cost])
      setNewCost(f => ({ ...f, amount: "" }))
    }
  }

  async function removeCost(costId: string) {
    const { supabase, db } = getCompanyClientBrowser()
    await db.from("purchase_costs").delete().eq("id", costId)
    setCosts(prev => prev.filter(c => c.id !== costId))
  }

  async function receive() {
    if (lines.some(l => !l.warehouse_id)) {
      alert("Assigner un entrepôt à chaque produit avant la réception.")
      return
    }
    if (showGNF && !rateToGNF) {
      alert("Aucun taux de change disponible. Ajoutez un taux dans Paramètres → Taux de change.")
      return
    }
    setSaving(true)
    const { supabase, db } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const orderFOBTotal = lines.reduce((s, l) => s + l.fob_total, 0)
    const discountTotal = orderFOBTotal * (order.global_discount_pct / 100)
    const totalExtra = costs.reduce((s, c) => s + c.amount, 0)

    const stockMoves = lines.map(l => {
      // Apply discount proportionally per line, then allocate extra costs
      const lineDiscount = orderFOBTotal > 0 ? discountTotal * (l.fob_total / orderFOBTotal) : 0
      const lineFOBNet = l.fob_total - lineDiscount
      const allocated = orderFOBTotal > 0 ? totalExtra * (l.fob_total / orderFOBTotal) : 0
      const landedUnit = l.quantity > 0 ? (lineFOBNet + allocated) / l.quantity : 0
      return {
        type: "in" as const,
        product_id: l.product_id,
        to_warehouse_id: l.warehouse_id,
        quantity: l.quantity,
        notes: `Réception ${order.number} — PR : ${formatCurrency(landedUnit, cur)}/u`,
        user_id: user.id,
      }
    })

    await db.from("stock_moves").insert(stockMoves)

    // Store buy_price in GNF (local currency) if conversion available, otherwise in order currency
    for (const l of lines) {
      if (!l.product_id) continue
      const lineDiscount2 = orderFOBTotal > 0 ? discountTotal * (l.fob_total / orderFOBTotal) : 0
      const lineFOBNet2 = l.fob_total - lineDiscount2
      const allocated = orderFOBTotal > 0 ? totalExtra * (l.fob_total / orderFOBTotal) : 0
      const landedUnit = l.quantity > 0 ? (lineFOBNet2 + allocated) / l.quantity : 0
      const buyPriceGNF = showGNF && rateToGNF ? Math.round(landedUnit * rateToGNF) : landedUnit
      await db.from("products").update({
        buy_price: buyPriceGNF,
        buy_price_currency: showGNF ? "GNF" : order.currency,
      }).eq("id", l.product_id)
    }

    await db.from("purchase_orders").update({ status: "received" }).eq("id", order.id)

    router.push(`/${locale}/achats`)
    router.refresh()
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link href={`/${locale}/achats`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Retour aux achats
      </Link>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{order.number}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusConfig[order.status]?.color}`}>
              {statusConfig[order.status]?.label}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-100 text-blue-700 border border-blue-200">
              {order.incoterm}
            </span>
          </div>
          <p className="text-gray-500 text-sm">Fournisseur : <strong>{order.supplier_name}</strong></p>
        </div>
        {isDraft && (
          <Button onClick={receive} disabled={saving}>
            <Truck className="w-4 h-4" />
            {saving ? "Réception…" : "Réceptionner la commande"}
          </Button>
        )}
        {order.status === "received" && (
          <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm px-3 py-2 bg-emerald-50 rounded-lg">
            <CheckCircle className="w-4 h-4" /> Réceptionné — stock et prix mis à jour
          </div>
        )}
      </div>

      {/* Taux de change banner */}
      {showGNF && rateToGNF && (
        <div className="mb-4 flex items-center gap-2 text-sm px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700">
          <ArrowRight className="w-4 h-4 flex-shrink-0" />
          Taux de change appliqué : <strong>1 {order.currency} = {rateToGNF.toLocaleString("fr")} GNF</strong>
          <span className="text-blue-400 text-xs ml-auto">Le prix de revient sera enregistré en GNF à la réception</span>
        </div>
      )}
      {order.currency !== "GNF" && !rateToGNF && (
        <div className="mb-4 flex items-center gap-2 text-sm px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-700">
          Aucun taux {order.currency} → GNF. Ajoutez-le dans <strong>Paramètres → Taux de change</strong>.
        </div>
      )}

      {/* Récap financier */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Sous-total marchandises</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalFOB, cur)}</p>
        </div>
        {order.global_discount_pct > 0 && (
          <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4 text-center">
            <p className="text-xs text-red-400 mb-1">Remise fournisseur ({order.global_discount_pct}%)</p>
            <p className="text-xl font-bold text-red-600">−{formatCurrency(discountAmt, cur)}</p>
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Frais annexes</p>
          <p className="text-xl font-bold text-amber-700">{formatCurrency(totalCosts, cur)}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4 text-center col-span-1">
          <p className="text-xs text-gray-400 mb-1">Prix de revient total</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(totalLanded, cur)}</p>
          {showGNF && rateToGNF && (
            <p className="text-xs text-gray-400 mt-1">≈ {formatCurrency(Math.round(totalLanded * rateToGNF), "GNF")}</p>
          )}
        </div>
      </div>

      {/* Détail incoterm */}
      {(order.freight_cost > 0 || order.insurance_cost > 0 || order.global_discount_pct > 0) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">Conditions {order.incoterm}</h2>
          <div className="space-y-1.5 max-w-xs">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Sous-total marchandises</span>
              <span className="font-medium text-gray-800">{formatCurrency(totalFOB, cur)}</span>
            </div>
            {order.freight_cost > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>+ Fret maritime</span>
                <span className="font-medium text-gray-800">{formatCurrency(order.freight_cost, cur)}</span>
              </div>
            )}
            {order.insurance_cost > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>+ Assurance maritime</span>
                <span className="font-medium text-gray-800">{formatCurrency(order.insurance_cost, cur)}</span>
              </div>
            )}
            {order.global_discount_pct > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>− Remise ({order.global_discount_pct}%)</span>
                <span className="font-medium">−{formatCurrency(discountAmt, cur)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="font-semibold text-gray-900">Total {order.incoterm}</span>
              <span className="text-lg font-bold text-blue-600">{formatCurrency(totalAfterDiscount + order.freight_cost + order.insurance_cost, cur)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Produits commandés */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <h2 className="font-semibold text-gray-800 px-5 py-4 border-b border-gray-50">Produits</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Produit</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Qté</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Prix FOB/u</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">FOB total</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 bg-amber-50/60">Frais alloués</th>
              <th className="text-right px-4 py-3 font-medium text-blue-700 bg-blue-50/60">PR/u ({cur})</th>
              {showGNF && <th className="text-right px-4 py-3 font-medium text-emerald-700 bg-emerald-50/60">PR/u (GNF)</th>}
              <th className="text-left px-4 py-3 font-medium text-gray-600">Entrepôt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lines.map(l => {
              const orderFOBTotal = lines.reduce((s, x) => s + x.fob_total, 0)
              const totalExtra = costs.reduce((s, c) => s + c.amount, 0)
              const lineDiscount = orderFOBTotal > 0 ? (orderFOBTotal * (order.global_discount_pct / 100)) * (l.fob_total / orderFOBTotal) : 0
              const lineFOBNet = l.fob_total - lineDiscount
              const allocated = orderFOBTotal > 0 ? totalExtra * (l.fob_total / orderFOBTotal) : 0
              const landedUnit = l.quantity > 0 ? (lineFOBNet + allocated) / l.quantity : 0

              return (
                <tr key={l.line_id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{l.description}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{l.quantity.toLocaleString("fr")}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(l.fob_unit_price, cur)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(l.fob_total, cur)}</td>
                  <td className="px-4 py-3 text-right text-amber-700 bg-amber-50/30 font-medium">
                    +{formatCurrency(allocated, cur)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700 bg-blue-50/30">
                    {formatCurrency(landedUnit, cur)}
                  </td>
                  {showGNF && rateToGNF && (
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 bg-emerald-50/30">
                      {formatCurrency(Math.round(landedUnit * rateToGNF), "GNF")}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {isDraft ? (
                      <select
                        value={l.warehouse_id ?? ""}
                        onChange={e => updateWarehouse(l.line_id, e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Choisir…</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.city ? `${w.name} — ${w.city}` : w.name}</option>)}
                      </select>
                    ) : (
                      <span className="text-gray-600 text-xs">{warehouses.find(w => w.id === l.warehouse_id)?.name ?? "—"}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Frais annexes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Frais annexes (coût de revient)</h2>

        <div className="space-y-2 mb-4">
          {costs.map(c => (
            <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
              <div>
                <span className="text-sm font-medium text-gray-800">{c.label}</span>
                <span className="ml-2 text-xs text-gray-400">{costTypeLabel[c.type]}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-amber-700">{formatCurrency(c.amount, c.currency as "USD" | "GNF" | "EUR")}</span>
                {isDraft && (
                  <button onClick={() => removeCost(c.id)} className="text-gray-300 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {costs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun frais ajouté</p>}
        </div>

        {isDraft && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 mb-3">Ajouter un frais</p>
            <div className="grid grid-cols-4 gap-2 items-end">
              <Select
                label="Type"
                value={newCost.type}
                onChange={e => setNewCost(f => ({ ...f, type: e.target.value, label: costTypeLabel[e.target.value] ?? e.target.value }))}
                options={Object.entries(costTypeLabel).map(([v, l]) => ({ value: v, label: l }))}
              />
              <Input
                label="Libellé"
                value={newCost.label}
                onChange={e => setNewCost(f => ({ ...f, label: e.target.value }))}
              />
              <Input
                label="Montant"
                type="number" min="0" step="any"
                value={newCost.amount}
                onChange={e => setNewCost(f => ({ ...f, amount: e.target.value }))}
              />
              <Button onClick={addCost} disabled={!newCost.amount}>
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
            </div>
          </div>
        )}
      </div>

      {order.notes && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Notes</p>
          <p className="text-sm text-gray-700">{order.notes}</p>
        </div>
      )}

      {/* Zone d'impression — masquée à l'écran */}
      <div className="print-root hidden print:block">
        <DocumentLayout
          type="bon_commande"
          number={order.number}
          date={order.order_date}
          dueDate={order.expected_date ?? undefined}
          settings={docSettings}
          recipientName={order.supplier_name}
          lines={lines.map(l => ({
            description: l.description,
            quantity: l.quantity,
            unit_price: l.fob_unit_price,
            discount: 0,
          }))}
          notes={order.notes ?? undefined}
          currency={order.currency}
          locale={locale}
        />
      </div>
    </div>
  )
}
