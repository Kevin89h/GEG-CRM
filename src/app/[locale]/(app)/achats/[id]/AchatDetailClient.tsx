"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Truck, Trash2, Plus, Star, ChevronRight, Package,
  MessageSquare, FileText, Printer, X, Check,
  Info, MoreHorizontal, Paperclip, Download,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
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

interface ReceptionLine { id: string; description: string; quantity: number; unit_price: number; warehouse_id: string | null }
interface Reception { id: string; number: string; received_at: string; purchase_reception_lines: ReceptionLine[] }

interface Props {
  order: Order
  lines: LandedLine[]
  costs: Cost[]
  warehouses: Warehouse[]
  exchangeRates: ExchangeRate[]
  locale: string
  receptions?: Reception[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docSettings?: Record<string, any>
}

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

type Tab = "produits" | "receptions" | "autres"

export default function AchatDetailClient({ order, lines: initialLines, costs: initialCosts, warehouses, exchangeRates, locale, receptions = [], docSettings = {} }: Props) {
  const t = useTranslations("achats")
  const router = useRouter()
  const [lines, setLines] = useState(initialLines)
  const [costs, setCosts] = useState(initialCosts)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")
  const [tab, setTab] = useState<Tab>("produits")
  const [newCost, setNewCost] = useState({ type: "transport_maritime", label: t("costTypeTransportMaritime"), amount: "", currency: order.currency })
  const [chatMsg, setChatMsg] = useState("")
  const [attachments, setAttachments] = useState<{ name: string; url: string; size: number }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing attachments from storage on mount
  useEffect(() => {
    async function loadAttachments() {
      const { supabase } = getCompanyClientBrowser()
      const { data } = await supabase.storage.from("documents").list(`achats/${order.id}`)
      if (!data) return
      const files = await Promise.all(data.map(async f => {
        const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(`achats/${order.id}/${f.name}`)
        return { name: f.name, url: publicUrl, size: f.metadata?.size ?? 0 }
      }))
      setAttachments(files)
    }
    loadAttachments()
  }, [order.id])

  async function uploadAttachment(file: File) {
    setUploading(true)
    const { supabase } = getCompanyClientBrowser()
    const path = `achats/${order.id}/${file.name}`
    const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path)
      setAttachments(prev => [...prev.filter(a => a.name !== file.name), { name: file.name, url: publicUrl, size: file.size }])
    }
    setUploading(false)
  }

  async function deleteAttachment(name: string) {
    const { supabase } = getCompanyClientBrowser()
    await supabase.storage.from("documents").remove([`achats/${order.id}/${name}`])
    setAttachments(prev => prev.filter(a => a.name !== name))
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  const costTypeLabel: Record<string, string> = {
    transport_maritime: t("costTypeTransportMaritime"),
    transport_routier: t("costTypeTransportRoutier"),
    douane: t("costTypeDouane"),
    tva_avance: t("costTypeTvaAvance"),
    transport_entrepot: t("costTypeTransportEntrepot"),
    dechargement: t("costTypeDechargement"),
    autre: t("costTypeAutre"),
  }

  const STATUS_STEPS = [
    { key: "draft",     label: t("statusDraft") },
    { key: "sent",      label: t("statusSent") },
    { key: "confirmed", label: t("statusConfirmed") },
  ]

  const isDraft = order.status === "draft"
  const isReceived = order.status === "received"
  const cur = order.currency as "USD" | "GNF" | "EUR"
  const stepIndex = getStepIndex(order.status)

  async function cancelOrder() {
    if (!confirm(t("confirmCancel"))) return
    const res = await fetch(`/api/achats/${order.id}/cancel`, { method: "POST" })
    const json = await res.json()
    if (!res.ok) { alert(json.error ?? "Erreur lors de l'annulation"); return }
    router.push(`/${locale}/achats`)
  }

  function handlePrint() {
    window.print()
  }

  async function sendMessage() {
    if (!chatMsg.trim()) return
    setChatMsg("")
    setStatusMsg(t("messageRegistered"))
  }

  function goToNewInvoice() {
    const params = new URLSearchParams({
      order_id: order.id,
      supplier: order.supplier_name,
      currency: order.currency,
      reference: order.number,
    })
    router.push(`/${locale}/comptabilite/factures-fournisseurs/nouveau?${params.toString()}`)
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
    const res = await fetch(`/api/achats/${order.id}/costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: newCost.type,
        label: newCost.label,
        amount: parseFloat(newCost.amount),
        currency: newCost.currency,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setCosts(prev => [...prev, json as Cost])
      setNewCost(f => ({ ...f, amount: "" }))
    } else {
      setStatusMsg(json.error ?? "Erreur ajout coût")
    }
  }

  async function removeCost(costId: string) {
    const res = await fetch(`/api/achats/costs/${costId}`, { method: "DELETE" })
    if (res.ok) {
      setCosts(prev => prev.filter(c => c.id !== costId))
    } else {
      const json = await res.json()
      setStatusMsg(json.error ?? "Erreur suppression coût")
    }
  }

  async function receive() {
    if (lines.some(l => !l.warehouse_id)) {
      setStatusMsg(t("assignWarehouseError"))
      return
    }
    setSaving(true)
    const { supabase } = getCompanyClientBrowser()
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

    const productUpdates = lines
      .filter(l => l.product_id)
      .map(l => {
        const lineDiscount2 = orderFOBTotal > 0 ? discountTotal * (l.fob_total / orderFOBTotal) : 0
        const lineFOBNet2 = l.fob_total - lineDiscount2
        const allocated = orderFOBTotal > 0 ? totalExtra * (l.fob_total / orderFOBTotal) : 0
        const landedUnit = l.quantity > 0 ? (lineFOBNet2 + allocated) / l.quantity : 0
        const buyPriceGNF = showGNF && rateToGNF ? Math.round(landedUnit * rateToGNF) : landedUnit
        return {
          product_id: l.product_id!,
          buy_price: buyPriceGNF,
          buy_price_currency: showGNF ? "GNF" : order.currency,
        }
      })

    const receptionLines = lines.map(l => {
      const lineDiscount3 = orderFOBTotal > 0 ? discountTotal * (l.fob_total / orderFOBTotal) : 0
      const lineFOBNet3 = l.fob_total - lineDiscount3
      const allocated3 = orderFOBTotal > 0 ? totalExtra * (l.fob_total / orderFOBTotal) : 0
      const landedUnit3 = l.quantity > 0 ? (lineFOBNet3 + allocated3) / l.quantity : 0
      return {
        order_line_id: l.line_id,
        product_id: l.product_id,
        description: l.description,
        quantity: l.quantity,
        unit_price: landedUnit3,
        warehouse_id: l.warehouse_id,
      }
    })

    const res = await fetch(`/api/achats/${order.id}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockMoves, productUpdates, receptionLines }),
    })
    const json = await res.json()
    if (!res.ok) {
      setStatusMsg(json.error ?? "Erreur lors de la réception")
      setSaving(false)
      return
    }

    router.push(`/${locale}/achats/${order.id}`)
    router.refresh()
  }

  const statusLabel = isReceived ? t("statusConfirmed") : isDraft ? t("statusDraft") : t("statusSent")
  const lineCount = lines.length

  return (
    <div className="-m-6 min-h-screen bg-gray-50/50">
      {/* ── Breadcrumb bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-2 text-sm">
        <button
          onClick={() => router.push(`/${locale}/achats`)}
          className="px-3 py-1.5 border border-gray-200 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          {t("new")}
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <Link href={`/${locale}/achats`} className="text-[#7c3aed] font-medium text-xs hover:underline">
          {t("priceRequests")}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-700 font-medium">{order.number || t("new")}</span>
        <span className="text-xs text-gray-400">⚙</span>

        {/* Smart button */}
        {lineCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
              <Truck className="w-3.5 h-3.5 text-blue-500" />
              {t("received")} {isReceived ? lineCount : 0}
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
                {saving ? t("receiving") : t("receive")}
              </button>
              {statusMsg && <p className="text-sm text-red-600 mt-2">{statusMsg}</p>}
            </>
          )}
          {isReceived && (
            <button onClick={goToNewInvoice} className="px-3 py-1.5 text-xs font-semibold rounded bg-[#017e84] text-white hover:opacity-90 transition">
              {t("loadInvoice")}
            </button>
          )}
          <button onClick={handlePrint} className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5" /> {t("print")}
          </button>
          <button className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5">
            <MoreHorizontal className="w-3.5 h-3.5" /> ...
          </button>
          {isDraft && (
            <button onClick={cancelOrder} className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-red-600 hover:bg-red-50 transition flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" /> {t("cancel")}
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
              <MessageSquare className="w-3.5 h-3.5" /> {t("sendMessage")}
            </button>
            {statusMsg && <p className="text-sm text-green-600">{statusMsg}</p>}
          </div>
          <button onClick={() => setChatMsg("📝 Note : ")} className="px-2.5 py-1.5 text-xs font-medium rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            {t("note")}
          </button>
          <button onClick={() => router.push(`/${locale}/activities`)} className="px-2.5 py-1.5 text-xs font-medium rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            {t("activity")}
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
                {t("noExchangeRateWarning", { currency: order.currency })}
              </div>
            )}

            {/* Document title */}
            <p className="text-xs text-gray-400 font-medium mb-1">{statusLabel}</p>
            <div className="flex items-center gap-3 mb-6">
              <Star className="w-5 h-5 text-gray-300 hover:text-amber-400 cursor-pointer transition" />
              <h1 className="text-3xl font-bold text-gray-800">{order.number || t("new")}</h1>
            </div>

            {/* Form grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 mb-6 text-sm">
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <label className="text-xs text-gray-500 w-36 flex-shrink-0 flex items-center gap-1">
                    {t("supplier")}
                  </label>
                  <span className="font-medium text-[#7c3aed]">{order.supplier_name}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <label className="text-xs text-gray-500 w-36 flex-shrink-0">{t("supplierReference")}</label>
                  <span className="text-gray-700">{order.incoterm || "—"}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <label className="text-xs text-gray-500 w-36 flex-shrink-0">{t("currency")}</label>
                  <span className={`font-medium ${order.currency === "GNF" ? "text-gray-700" : "text-[#7c3aed]"}`}>{order.currency}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <label className="text-xs text-gray-500 w-44 flex-shrink-0">{t("orderDeadline")}</label>
                  <span className="text-gray-700">
                    {order.order_date ? formatDate(order.order_date, locale) : "—"}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <label className="text-xs text-gray-500 w-44 flex-shrink-0">{t("expectedArrival")}</label>
                  <span className="text-gray-700">
                    {order.expected_date ? formatDate(order.expected_date, locale) : "—"}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <label className="text-xs text-gray-500 w-44 flex-shrink-0">{t("deliverTo")}</label>
                  <span className="text-[#7c3aed] text-xs">GEG SAS Guinée : {t("receptions")}</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-0">
              <div className="flex gap-0">
                {[
                  { key: "produits" as Tab, label: t("tabProducts") },
                  { key: "receptions" as Tab, label: `Réceptions${receptions.length > 0 ? ` (${receptions.length})` : ""}` },
                  { key: "autres" as Tab, label: t("tabOtherInfo") },
                ].map(tb => (
                  <button
                    key={tb.key}
                    onClick={() => setTab(tb.key)}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${
                      tab === tb.key
                        ? "border-[#7c3aed] text-[#7c3aed]"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tb.label}
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
                      <th className="text-left px-4 py-3">{t("colProduct")}</th>
                      <th className="text-left px-4 py-3">{t("colAnalytic")}</th>
                      <th className="text-right px-4 py-3">{t("colQuantity")}</th>
                      <th className="text-right px-4 py-3">{t("colReceived")}</th>
                      <th className="text-left px-4 py-3">{t("colUnit")}</th>
                      <th className="text-right px-4 py-3">{t("colUnitPrice")}</th>
                      <th className="text-right px-4 py-3">{t("colTaxes")}</th>
                      <th className="text-right px-4 py-3">{t("colAmount")}</th>
                      {isDraft && <th className="text-left px-4 py-3">{t("colWarehouse")}</th>}
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
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{t("unitLabel")}</td>
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
                                <option value="">{t("chooseWarehouse")}</option>
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
                  <button className="text-[#7c3aed] hover:underline font-medium">{t("addProduct")}</button>
                  <button className="text-[#7c3aed] hover:underline">{t("addSection")}</button>
                  <button className="text-[#7c3aed] hover:underline">{t("addNote")}</button>
                  <button className="text-[#7c3aed] hover:underline">{t("catalog")}</button>
                </div>

                {/* Notes + Totals */}
                <div className="flex border-t border-gray-100">
                  <div className="flex-1 p-4">
                    <textarea
                      defaultValue={order.notes ?? ""}
                      placeholder={t("termsPlaceholder")}
                      className="w-full h-16 text-xs text-gray-500 resize-none focus:outline-none placeholder:text-gray-300 bg-transparent"
                    />
                  </div>
                  <div className="w-64 p-4 border-l border-gray-100 space-y-2 text-xs">
                    {order.global_discount_pct > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>{t("discount")} ({order.global_discount_pct}%)</span>
                        <span className="text-red-500">−{formatCurrency(discountAmt, cur)}</span>
                      </div>
                    )}
                    {totalCosts > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>{t("additionalCosts")}</span>
                        <span className="text-amber-600">+{formatCurrency(totalCosts, cur)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600 font-medium border-t border-gray-100 pt-2">
                      <span>{t("amountExclTax")} :</span>
                      <span className="tabular-nums">{formatCurrency(totalFOB, cur)}</span>
                    </div>
                    <div className="flex justify-between text-gray-900 font-bold text-sm">
                      <span>{t("total")} :</span>
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

            {/* Tab: Réceptions */}
            {tab === "receptions" && (
              <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-5 mb-4">
                {receptions.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Aucun bon de réception — réceptionnez la commande pour en créer un.</p>
                ) : (
                  <div className="space-y-4">
                    {receptions.map(rec => (
                      <div key={rec.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <div className="flex items-center gap-3">
                            <Package className="w-4 h-4 text-emerald-600" />
                            <span className="font-semibold text-gray-800 text-sm">{rec.number}</span>
                            <span className="text-xs text-gray-400">{formatDate(rec.received_at, locale)}</span>
                          </div>
                          <button
                            onClick={() => {
                              const params = new URLSearchParams({
                                order_id: order.id,
                                reception_id: rec.id,
                                supplier: order.supplier_name,
                                currency: order.currency,
                                reference: rec.number,
                              })
                              router.push(`/${locale}/comptabilite/factures-fournisseurs/nouveau?${params.toString()}`)
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded bg-[#017e84] text-white hover:opacity-90 transition flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" /> Créer facture fournisseur
                          </button>
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-100 bg-white">
                              <th className="text-left px-4 py-2">Produit</th>
                              <th className="text-right px-4 py-2">Qté reçue</th>
                              <th className="text-right px-4 py-2">Prix revient/u</th>
                              <th className="text-left px-4 py-2">Entrepôt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {rec.purchase_reception_lines.map(l => {
                              const wh = warehouses.find(w => w.id === l.warehouse_id)
                              return (
                                <tr key={l.id} className="hover:bg-gray-50/50">
                                  <td className="px-4 py-2.5 font-medium text-gray-800">{l.description}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{l.quantity.toLocaleString("fr")}</td>
                                  <td className="px-4 py-2.5 text-right text-blue-700 font-semibold tabular-nums">{formatCurrency(l.unit_price, cur)}</td>
                                  <td className="px-4 py-2.5 text-gray-500">{wh ? (wh.city ? `${wh.name} — ${wh.city}` : wh.name) : "—"}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Autres informations */}
            {tab === "autres" && (
              <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-5 mb-4 space-y-6">
                {/* Incoterm details */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t("incotermConditions")} {order.incoterm}</h3>
                  <div className="space-y-2 max-w-sm">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t("goodsSubtotal")}</span>
                      <span className="font-medium">{formatCurrency(totalFOB, cur)}</span>
                    </div>
                    {order.freight_cost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">+ {t("seaFreight")}</span>
                        <span className="font-medium">{formatCurrency(order.freight_cost, cur)}</span>
                      </div>
                    )}
                    {order.insurance_cost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">+ {t("seaInsurance")}</span>
                        <span className="font-medium">{formatCurrency(order.insurance_cost, cur)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Frais annexes */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t("additionalCostsTitle")}</h3>
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
                    {costs.length === 0 && <p className="text-sm text-gray-400 text-center py-3">{t("noCostsAdded")}</p>}
                  </div>

                  {isDraft && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 items-end">
                        <Select
                          label={t("type")}
                          value={newCost.type}
                          onChange={e => setNewCost(f => ({ ...f, type: e.target.value, label: costTypeLabel[e.target.value] ?? e.target.value }))}
                          options={Object.entries(costTypeLabel).map(([v, l]) => ({ value: v, label: l }))}
                        />
                        <Input label={t("labelField")} value={newCost.label} onChange={e => setNewCost(f => ({ ...f, label: e.target.value }))} />
                        <Input label={t("amount")} type="number" min="0" step="any" value={newCost.amount} onChange={e => setNewCost(f => ({ ...f, amount: e.target.value }))} />
                        <button
                          onClick={addCost}
                          disabled={!newCost.amount}
                          className="px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-500 transition disabled:opacity-40 flex items-center gap-1.5 justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" /> {t("add")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Prix de revient par ligne */}
                {lines.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t("landedCostPerProduct")}</h3>
                    <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-100">
                          <th className="text-left py-2">{t("colProduct")}</th>
                          <th className="text-right py-2">FOB/u</th>
                          <th className="text-right py-2 text-amber-600">{t("allocatedCosts")}</th>
                          <th className="text-right py-2 text-blue-700">{t("landedUnitPrice")} ({cur})</th>
                          {showGNF && <th className="text-right py-2 text-emerald-700">{t("landedUnitPrice")} (GNF)</th>}
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
              placeholder={t("sendMessagePlaceholder")}
              className="w-full h-20 text-xs border border-gray-200 rounded p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400 placeholder:text-gray-300"
            />
            <div className="mt-2 flex items-center gap-2">
              {chatMsg && (
                <button className="px-3 py-1.5 text-xs font-medium bg-[#7c3aed] text-white rounded hover:bg-[#6d28d9] transition">
                  {t("send")}
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Joindre un fichier"
                className="p-1.5 rounded border border-gray-200 text-gray-400 hover:text-purple-600 hover:border-purple-300 transition disabled:opacity-40"
              >
                <Paperclip className={`w-4 h-4 ${uploading ? "animate-pulse" : ""}`} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={e => {
                  Array.from(e.target.files ?? []).forEach(uploadAttachment)
                  e.target.value = ""
                }}
              />
            </div>

            {/* Attachments list */}
            {attachments.length > 0 && (
              <div className="mt-3 space-y-1">
                {attachments.map(a => (
                  <div key={a.name} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded text-xs group">
                    <Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 truncate text-gray-700 font-medium">{a.name}</span>
                    <span className="text-gray-400 flex-shrink-0">{formatSize(a.size)}</span>
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-600 transition flex-shrink-0">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={() => deleteAttachment(a.name)} className="text-gray-300 hover:text-red-400 transition flex-shrink-0 opacity-0 group-hover:opacity-100">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
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
                  <span className="text-xs font-semibold text-gray-800">{t("logistics")}</span>
                  <span className="text-[10px] text-gray-400">{order.order_date ? formatDate(order.order_date, locale) : "—"}</span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{t("orderCreated")}</p>
              </div>
            </div>

            {isReceived && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">L</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-gray-800">{t("logistics")}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {t("statusDraft")} <ChevronRight className="w-3 h-3 inline" /> <span className="text-[#7c3aed] font-medium">{t("statusConfirmed")}</span> <span className="text-gray-400">({t("statusLabel")})</span>
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
                <p className="text-xs text-gray-500 mt-0.5 italic">{t("newRecordCreation")}</p>
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
