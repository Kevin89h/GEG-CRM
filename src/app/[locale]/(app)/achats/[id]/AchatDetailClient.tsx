"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Truck, Trash2, Plus, Star, ChevronRight, Package,
  MessageSquare, Clock, FileText, Printer, X, Check,
  Info, MoreHorizontal,
} from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatCurrency, formatDate } from "@/lib/utils"
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

const STATUS_STEPS = [
  { key: "draft",     label: "Demande de prix" },
  { key: "sent",      label: "Envoyé" },
  { key: "confirmed", label: "Bon de commande" },
]

function getStepIndex(status: string) {
  if (status === "received" || status === "confirmed") return 2
  if (status === "sent") return 1
  return 0
}

function getRate(rates: ExchangeRate[], from: string, to: string): number | null {
  if (from === to) return 1
  const match = rates
    .filter(r => r.from_currency === from && r.to_currency === to)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0]
  return match?.rate ?? null
}

type Tab = "produits" | "autres"

export default function AchatDetailClient({ order, lines: initialLines, costs: initialCosts, warehouses, exchangeRates, locale, docSettings = {} }: Props) {
  const router = useRouter()
  const [lines, setLines] = useState(initialLines)
  const [costs, setCosts] = useState(initialCosts)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")
  const [tab, setTab] = useState<Tab>("produits")
  const [newCost, setNewCost] = useState({ type: "transport_maritime", label: "Transport maritime", amount: "", currency: order.currency })
  const [chatMsg, setChatMsg] = useState("")

  const isDraft = order.status === "draft"
  const isReceived = order.status === "received"
  const cur = order.currency as "USD" | "GNF" | "EUR"
  const stepIndex = getStepIndex(order.status)

  async function cancelOrder() {
    if (!confirm("Annuler cette commande ?")) return
    const { db } = getCompanyClientBrowser()
    await db.from("purchase_orders").update({ status: "cancelled" }).eq("id", order.id)
    router.push(`/${locale}/achats`)
  }

  function handlePrint() {
    window.print()
  }

  async function sendMessage() {
    if (!chatMsg.trim()) return
    setChatMsg("")
    setStatusMsg("Message enregistré (chatter à venir).")
  }

  function goToNewInvoice() {
    router.push(`/${locale}/achats`)
  }

  const totalFOB = lines.reduce((s, l) => s + l.fob_total, 0)
  const discountAmt = totalFOB * (order.global_discount_pct / 100)
  const totalAfterDiscount = totalFOB - discountAmt
  const totalCosts = costs.reduce((s, c) => s + c.amount, 0)
  const totalLanded = totalAfterDiscount + totalCosts

  const rateToGNF = getRate(exchangeRates, order.currency, "GNF")
  const showGNF = order.currency !== "GNF" && rateToGNF !== null

  function updateWarehouse(lineId: string, warehouseId: string) {
    setLines(prev => prev.map(l => l.line_id === lineId ? { ...l, warehouse_id: warehouseId } : l))
  }

  async function addCost() {
    if (!newCost.amount) return
    const { db } = getCompanyClientBrowser()
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
    const { db } = getCompanyClientBrowser()
    await db.from("purchase_costs").delete().eq("id", costId)
    setCosts(prev => prev.filter(c => c.id !== costId))
  }

  async function receive() {
    if (lines.some(l => !l.warehouse_id)) {
      setStatusMsg("Assigner un entrepôt à chaque produit avant la réception.")
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

  const statusLabel = isReceived ? "Bon de commande" : isDraft ? "Demande de prix" : "Envoyé"
  const lineCount = lines.length

  return (
    <div className="-m-6 min-h-screen bg-gray-50/50">
      {/* ── Breadcrumb bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-2 text-sm">
        <button
          onClick={() => router.push(`/${locale}/achats`)}
          className="px-3 py-1.5 border border-gray-200 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          Nouveau
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <Link href={`/${locale}/achats`} className="text-[#7c3aed] font-medium text-xs hover:underline">
          Demandes de prix
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-700 font-medium">{order.number || "Nouveau"}</span>
        <span className="text-xs text-gray-400">⚙</span>

        {/* Smart button */}
        {lineCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
              <Truck className="w-3.5 h-3.5 text-blue-500" />
              Reçu {isReceived ? lineCount : 0}
            </div>
          </div>
        )}
      </div>

      {/* ── Action buttons + Status pipeline ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-2">
        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {isDraft && (
            <>
              <button
                onClick={receive}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-[#017e84] text-white hover:bg-[#016b70] transition disabled:opacity-50"
              >
                {saving ? "Réception…" : "Recevoir"}
              </button>
              {statusMsg && <p className="text-sm text-red-600 mt-2">{statusMsg}</p>}
            </>
          )}
          {isReceived && (
            <button onClick={goToNewInvoice} className="px-3 py-1.5 text-xs font-semibold rounded bg-[#017e84] text-white hover:opacity-90 transition">
              Charger la facture
            </button>
          )}
          <button onClick={handlePrint} className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Imprimer
          </button>
          <button className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5">
            <MoreHorizontal className="w-3.5 h-3.5" /> ...
          </button>
          {isDraft && (
            <button onClick={cancelOrder} className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-red-600 hover:bg-red-50 transition flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" /> Annuler
            </button>
          )}
        </div>

        {/* Status pipeline */}
        <div className="ml-auto flex items-center gap-0">
          {STATUS_STEPS.map((step, i) => {
            const active = i === stepIndex
            const done = i < stepIndex
            return (
              <div
                key={step.key}
                className={`flex items-center ${i > 0 ? "-ml-2" : ""}`}
                style={{ zIndex: STATUS_STEPS.length - i }}
              >
                {i > 0 && (
                  <div className={`w-4 h-7 -skew-x-6 ${done ? "bg-[#017e84]" : active ? "bg-white border border-gray-300" : "bg-gray-100"}`} />
                )}
                <div className={`px-4 py-1.5 text-xs font-medium ${i > 0 ? "pl-3" : "pl-4"} pr-5 ${
                  done ? "bg-[#017e84] text-white" :
                  active ? "bg-white border border-gray-300 text-gray-800 font-semibold" :
                  "bg-gray-100 text-gray-400"
                }`}>
                  {done && <Check className="w-3 h-3 inline mr-1" />}
                  {step.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* Right panel actions */}
        <div className="flex items-center gap-1 ml-4 border-l border-gray-200 pl-4">
          <div className="flex flex-col items-start gap-1">
            <button onClick={sendMessage} className="px-2.5 py-1.5 text-xs font-semibold rounded bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Envoyer message
            </button>
            {statusMsg && <p className="text-sm text-green-600">{statusMsg}</p>}
          </div>
          <button onClick={() => setChatMsg("📝 Note : ")} className="px-2.5 py-1.5 text-xs font-medium rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            Note
          </button>
          <button onClick={() => router.push(`/${locale}/activities`)} className="px-2.5 py-1.5 text-xs font-medium rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            Activité
          </button>
        </div>
      </div>

      {/* ── Main content: 2-column layout ── */}
      <div className="flex gap-0 h-[calc(100vh-130px)]">
        {/* Left: Form */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-4xl">
            {/* Exchange rate warning */}
            {order.currency !== "GNF" && !rateToGNF && (
              <div className="mb-4 flex items-center gap-2 text-xs px-3 py-2 bg-amber-50 border border-amber-200 rounded text-amber-700">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                Aucun taux {order.currency} → GNF. Ajoutez-le dans <strong>Paramètres → Taux de change</strong>.
              </div>
            )}

            {/* Document title */}
            <p className="text-xs text-gray-400 font-medium mb-1">{statusLabel}</p>
            <div className="flex items-center gap-3 mb-6">
              <Star className="w-5 h-5 text-gray-300 hover:text-amber-400 cursor-pointer transition" />
              <h1 className="text-3xl font-bold text-gray-800">{order.number || "Nouveau"}</h1>
            </div>

            {/* Form grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 mb-6 text-sm">
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <label className="text-xs text-gray-500 w-36 flex-shrink-0 flex items-center gap-1">
                    Fournisseur
                  </label>
                  <span className="font-medium text-[#7c3aed]">{order.supplier_name}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <label className="text-xs text-gray-500 w-36 flex-shrink-0">Référence fournisseur</label>
                  <span className="text-gray-700">{order.incoterm || "—"}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <label className="text-xs text-gray-500 w-36 flex-shrink-0">Devise</label>
                  <span className={`font-medium ${order.currency === "GNF" ? "text-gray-700" : "text-[#7c3aed]"}`}>{order.currency}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <label className="text-xs text-gray-500 w-44 flex-shrink-0">Échéance de commande</label>
                  <span className="text-gray-700">
                    {order.order_date ? formatDate(order.order_date, locale) : "—"}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <label className="text-xs text-gray-500 w-44 flex-shrink-0">Arrivée prévue</label>
                  <span className="text-gray-700">
                    {order.expected_date ? formatDate(order.expected_date, locale) : "—"}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <label className="text-xs text-gray-500 w-44 flex-shrink-0">Livrer à</label>
                  <span className="text-[#7c3aed] text-xs">GEG SAS Guinée : Réceptions</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-0">
              <div className="flex gap-0">
                {[
                  { key: "produits" as Tab, label: "Produits" },
                  { key: "autres" as Tab, label: "Autres informations" },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${
                      tab === t.key
                        ? "border-[#7c3aed] text-[#7c3aed]"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab: Produits */}
            {tab === "produits" && (
              <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg overflow-hidden mb-4">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500 font-medium bg-gray-50">
                      <th className="text-left px-4 py-3 w-8"></th>
                      <th className="text-left px-4 py-3">Produit</th>
                      <th className="text-left px-4 py-3">Analytique</th>
                      <th className="text-right px-4 py-3">Quantité</th>
                      <th className="text-right px-4 py-3">Reçu</th>
                      <th className="text-left px-4 py-3">Unité de mes.</th>
                      <th className="text-right px-4 py-3">Prix unitaire</th>
                      <th className="text-right px-4 py-3">Taxes</th>
                      <th className="text-right px-4 py-3">Montant</th>
                      {isDraft && <th className="text-left px-4 py-3">Entrepôt</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map(l => {
                      const orderFOBTotal = lines.reduce((s, x) => s + x.fob_total, 0)
                      const totalExtra = costs.reduce((s, c) => s + c.amount, 0)
                      const lineDiscount = orderFOBTotal > 0 ? (orderFOBTotal * (order.global_discount_pct / 100)) * (l.fob_total / orderFOBTotal) : 0
                      const lineFOBNet = l.fob_total - lineDiscount
                      const allocated = orderFOBTotal > 0 ? totalExtra * (l.fob_total / orderFOBTotal) : 0
                      const landedUnit = l.quantity > 0 ? (lineFOBNet + allocated) / l.quantity : 0

                      return (
                        <tr key={l.line_id} className="hover:bg-gray-50/50 group">
                          <td className="px-4 py-2.5 text-gray-300 group-hover:text-gray-400">
                            <div className="w-4 h-4 flex flex-col gap-0.5 justify-center">
                              <div className="w-full h-0.5 bg-current rounded" />
                              <div className="w-full h-0.5 bg-current rounded" />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-medium text-[#7c3aed]">{l.description}</td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs">—</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{l.quantity.toLocaleString("fr")}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{isReceived ? l.quantity.toLocaleString("fr") : "0,00"}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">Unité</td>
                          <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">
                            {l.fob_unit_price.toLocaleString("fr", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-400 text-xs">—</td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900 tabular-nums">
                            {l.fob_total.toLocaleString("fr", { minimumFractionDigits: 2 })}
                          </td>
                          {isDraft && (
                            <td className="px-4 py-2.5">
                              <select
                                value={l.warehouse_id ?? ""}
                                onChange={e => updateWarehouse(l.line_id, e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                              >
                                <option value="">Choisir…</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.city ? `${w.name} — ${w.city}` : w.name}</option>)}
                              </select>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                </div>
                {/* Add links */}
                <div className="px-4 py-3 flex items-center gap-4 text-xs border-t border-gray-100">
                  <button className="text-[#7c3aed] hover:underline font-medium">Ajouter un produit</button>
                  <button className="text-[#7c3aed] hover:underline">Ajouter une section</button>
                  <button className="text-[#7c3aed] hover:underline">Ajouter une note</button>
                  <button className="text-[#7c3aed] hover:underline">Catalogue</button>
                </div>

                {/* Notes + Totals */}
                <div className="flex border-t border-gray-100">
                  <div className="flex-1 p-4">
                    <textarea
                      defaultValue={order.notes ?? ""}
                      placeholder="Définissez vos conditions générales..."
                      className="w-full h-16 text-xs text-gray-500 resize-none focus:outline-none placeholder:text-gray-300 bg-transparent"
                    />
                  </div>
                  <div className="w-64 p-4 border-l border-gray-100 space-y-2 text-xs">
                    {order.global_discount_pct > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Remise ({order.global_discount_pct}%)</span>
                        <span className="text-red-500">−{formatCurrency(discountAmt, cur)}</span>
                      </div>
                    )}
                    {totalCosts > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Frais annexes</span>
                        <span className="text-amber-600">+{formatCurrency(totalCosts, cur)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600 font-medium border-t border-gray-100 pt-2">
                      <span>Montant hors taxes :</span>
                      <span className="tabular-nums">{formatCurrency(totalFOB, cur)}</span>
                    </div>
                    <div className="flex justify-between text-gray-900 font-bold text-sm">
                      <span>Total :</span>
                      <span className="tabular-nums">{formatCurrency(totalLanded, cur)}</span>
                    </div>
                    {showGNF && rateToGNF && (
                      <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-1">
                        <span>≈ GNF</span>
                        <span>{formatCurrency(Math.round(totalLanded * rateToGNF), "GNF")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Autres informations */}
            {tab === "autres" && (
              <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-5 mb-4 space-y-6">
                {/* Incoterm details */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Conditions {order.incoterm}</h3>
                  <div className="space-y-2 max-w-sm">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Sous-total marchandises</span>
                      <span className="font-medium">{formatCurrency(totalFOB, cur)}</span>
                    </div>
                    {order.freight_cost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">+ Fret maritime</span>
                        <span className="font-medium">{formatCurrency(order.freight_cost, cur)}</span>
                      </div>
                    )}
                    {order.insurance_cost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">+ Assurance maritime</span>
                        <span className="font-medium">{formatCurrency(order.insurance_cost, cur)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Frais annexes */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Frais annexes (coût de revient)</h3>
                  <div className="space-y-2">
                    {costs.map(c => (
                      <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded bg-gray-50">
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
                    {costs.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Aucun frais ajouté</p>}
                  </div>

                  {isDraft && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 items-end">
                        <Select
                          label="Type"
                          value={newCost.type}
                          onChange={e => setNewCost(f => ({ ...f, type: e.target.value, label: costTypeLabel[e.target.value] ?? e.target.value }))}
                          options={Object.entries(costTypeLabel).map(([v, l]) => ({ value: v, label: l }))}
                        />
                        <Input label="Libellé" value={newCost.label} onChange={e => setNewCost(f => ({ ...f, label: e.target.value }))} />
                        <Input label="Montant" type="number" min="0" step="any" value={newCost.amount} onChange={e => setNewCost(f => ({ ...f, amount: e.target.value }))} />
                        <button
                          onClick={addCost}
                          disabled={!newCost.amount}
                          className="px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-500 transition disabled:opacity-40 flex items-center gap-1.5 justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" /> Ajouter
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Prix de revient par ligne */}
                {lines.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prix de revient par produit</h3>
                    <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-100">
                          <th className="text-left py-2">Produit</th>
                          <th className="text-right py-2">FOB/u</th>
                          <th className="text-right py-2 text-amber-600">Frais alloués</th>
                          <th className="text-right py-2 text-blue-700">PR/u ({cur})</th>
                          {showGNF && <th className="text-right py-2 text-emerald-700">PR/u (GNF)</th>}
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
                            <tr key={l.line_id} className="py-2">
                              <td className="py-2 text-gray-700">{l.description}</td>
                              <td className="py-2 text-right text-gray-600">{formatCurrency(l.fob_unit_price, cur)}</td>
                              <td className="py-2 text-right text-amber-600">+{formatCurrency(allocated / l.quantity, cur)}</td>
                              <td className="py-2 text-right font-bold text-blue-700">{formatCurrency(landedUnit, cur)}</td>
                              {showGNF && rateToGNF && (
                                <td className="py-2 text-right font-bold text-emerald-700">{formatCurrency(Math.round(landedUnit * rateToGNF), "GNF")}</td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Chatter */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
          {/* Message input */}
          <div className="p-4 border-b border-gray-100">
            <textarea
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              placeholder="Envoyer un message..."
              className="w-full h-20 text-xs border border-gray-200 rounded p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400 placeholder:text-gray-300"
            />
            {chatMsg && (
              <button className="mt-2 px-3 py-1.5 text-xs font-medium bg-[#7c3aed] text-white rounded hover:bg-[#6d28d9] transition">
                Envoyer
              </button>
            )}
          </div>

          {/* Activity log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="text-center text-[10px] text-gray-400 font-medium py-1">
              {formatDate(new Date().toISOString(), locale)}
            </div>

            {/* Auto-generated event: creation */}
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">L</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-gray-800">Logistique</span>
                  <span className="text-[10px] text-gray-400">{order.order_date ? formatDate(order.order_date, locale) : "—"}</span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">Commande créée</p>
              </div>
            </div>

            {isReceived && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">L</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-gray-800">Logistique</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Demande de prix <ChevronRight className="w-3 h-3 inline" /> <span className="text-[#7c3aed] font-medium">Bon de commande</span> <span className="text-gray-400">(Statut)</span>
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                {order.supplier_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-gray-800">{order.supplier_name}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 italic">Création d&apos;un nouvel enregistrement...</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print layout (hidden) */}
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
