"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircle, Receipt, X, Printer, ArrowLeft, RotateCcw, Truck, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatDate, formatNumber } from "@/lib/utils"
import DocumentLayout from "@/components/print/DocumentLayout"

interface Line {
  id: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  tva_exempt?: boolean | null
  product: { name: string; reference: string | null } | null
  unit?: { name: string } | null
}

interface Order {
  id: string
  number: string
  status: string
  currency: string
  valid_until: string | null
  notes: string | null
  created_at: string
  date_order?: string | null
  payment_terms?: string | null
  client_order_ref?: string | null
  tva?: boolean | null
  account: { id: string; name: string; country: string | null } | null
  contact: { id: string; first_name: string; last_name: string } | null
  salesperson?: { full_name: string } | null
  lines: Line[]
}

interface ProductOption {
  id: string
  name: string
  reference: string | null
  sale_price: number | null
  unit: { name: string } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { order: Order; locale: string; docSettings?: Record<string, any>; stockByProduct: Record<string, number>; firstWarehouse: { id: string; name: string } | null; invoiceCount?: number; firstInvoiceId?: string | null; deliveryCount?: number; allProducts?: ProductOption[] }

function getStepIndex(status: string) {
  if (status === "draft") return 0
  if (status === "confirmed") return 2
  if (status === "invoiced") return 3
  return -1 // cancelled
}

export default function DevisDetailClient({ order, locale, docSettings = {}, stockByProduct, firstWarehouse, invoiceCount = 0, firstInvoiceId = null, deliveryCount = 0, allProducts = [] }: Props) {
  const t = useTranslations("devis")
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"lines" | "other" | "notes">("lines")
  const [tva, setTva] = useState<boolean>(order.tva ?? false)
  const [lines, setLines] = useState<Line[]>(order.lines)
  const [productSearch, setProductSearch] = useState<Record<string, string>>({})
  const [orderFields, setOrderFields] = useState({
    payment_terms: order.payment_terms ?? "",
    valid_until: order.valid_until ?? "",
    client_order_ref: order.client_order_ref ?? "",
  })
  const isDraft = order.status === "draft"

  const PAYMENT_TERMS_LABELS: Record<string, string> = {
    immediate: t("paymentImmediate"),
    "15j": t("payment15j"),
    "21j": "21 jours",
    "30j": t("payment30j"),
    "45j": t("payment45j"),
    "60j": t("payment60j"),
    avance: t("paymentAdvance"),
  }

  const STEPS = [
    { key: "draft", label: t("stepDraft") },
    { key: "confirmed", label: t("stepConfirmed") },
    { key: "invoiced_pending", label: t("stepToInvoice") },
    { key: "invoiced", label: t("stepInvoiced") },
  ]

  const tabs = [
    { key: "lines", label: t("tabLines") },
    { key: "other", label: t("tabOther") },
    { key: "notes", label: t("tabNotes") },
  ] as const

  function getStockStatus(productId: string | null | undefined, qty: number): "ok" | "low" | "none" {
    if (!productId) return "ok"
    const avail = stockByProduct[productId] ?? 0
    if (avail >= qty) return "ok"
    if (avail > 0) return "low"
    return "none"
  }


  function lineTotal(l: Line) {
    return l.quantity * l.unit_price * (1 - l.discount / 100)
  }
  const total = lines.reduce((s, l) => s + lineTotal(l), 0)
  const totalTaxable = lines.filter(l => !l.tva_exempt).reduce((s, l) => s + lineTotal(l), 0)
  const tvaAmount = tva ? totalTaxable * 0.18 : 0
  const totalTTC = total + tvaAmount

  async function toggleTva() {
    const newVal = !tva
    setTva(newVal)
    await fetch(`/api/devis/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tva: newVal }),
    })
  }

  async function toggleLineExempt(lineId: string) {
    const line = lines.find(l => l.id === lineId)
    if (!line) return
    const newVal = !line.tva_exempt
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, tva_exempt: newVal } : l))
    await fetch(`/api/devis/${order.id}/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tva_exempt: newVal }),
    })
  }

  async function updateLine(lineId: string, field: "description" | "quantity" | "unit_price" | "discount", value: string) {
    const numVal = field !== "description" ? parseFloat(value) || 0 : 0
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, [field]: field === "description" ? value : numVal } : l))
    await fetch(`/api/devis/${order.id}/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: field === "description" ? value : numVal }),
    })
  }

  async function deleteLine(lineId: string) {
    setLines(prev => prev.filter(l => l.id !== lineId))
    const res = await fetch(`/api/devis/${order.id}/lines/${lineId}`, { method: "DELETE" })
    if (!res.ok) {
      const json = await res.json()
      alert(`Erreur: ${json.error}`)
    }
  }

  async function addLine() {
    const res = await fetch(`/api/devis/${order.id}/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Nouvelle ligne", quantity: 1, unit_price: 0, discount: 0 }),
    })
    const data = await res.json()
    if (!res.ok) {
      alert(`Erreur: ${data.error ?? res.status}`)
      return
    }
    setLines(prev => [...prev, { ...data, product: null, unit: null, tva_exempt: false }])
  }

  async function selectProduct(lineId: string, productId: string) {
    const p = allProducts.find(p => p.id === productId)
    if (!p) return
    setProductSearch(prev => ({ ...prev, [lineId]: "" }))
    setLines(prev => prev.map(l => l.id === lineId ? {
      ...l,
      description: p.name,
      unit_price: p.sale_price ?? l.unit_price,
      product: { name: p.name, reference: p.reference },
      unit: p.unit,
    } : l))
    await fetch(`/api/devis/${order.id}/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, description: p.name, unit_price: p.sale_price ?? 0 }),
    })
  }

  async function updateOrderField(field: string, value: string) {
    setOrderFields(prev => ({ ...prev, [field]: value }))
    await fetch(`/api/devis/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    })
  }

  async function confirm() {
    setLoading(true)
    const res = await fetch(`/api/devis/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    })
    if (!res.ok) {
      const json = await res.json()
      alert(json.error ?? "Erreur lors de la confirmation")
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
  }

  async function cancel() {
    if (!window.confirm(t("confirmCancel"))) return
    setLoading(true)
    const res = await fetch(`/api/devis/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    })
    if (!res.ok) {
      const json = await res.json()
      alert(json.error ?? "Erreur lors de l'annulation")
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
  }

  async function resetToDraft() {
    setLoading(true)
    const res = await fetch(`/api/devis/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    })
    if (!res.ok) {
      const json = await res.json()
      alert(json.error ?? "Erreur lors de la remise en brouillon")
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
  }

  async function createInvoice() {
    setLoading(true)
    const { supabase } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const res = await fetch(`/api/devis/${order.id}/create-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: order.account?.id ?? null,
        currency: order.currency,
        tva,
        lines: lines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount: l.discount,
          product_id: (l as unknown as { product_id?: string }).product_id ?? null,
          tva_exempt: l.tva_exempt ?? false,
        })),
        user_id: user.id,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? "Erreur lors de la création de la facture")
      setLoading(false)
      return
    }
    router.push(`/${locale}/ventes/factures/${json.invoiceId}`)
  }

  const isCancelled = order.status === "cancelled"
  const stepIndex = getStepIndex(order.status)

  return (
    <div className="max-w-5xl mx-auto">
      <Link href={`/${locale}/ventes/devis`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("backToQuotes")}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{order.number}</h1>
            {isCancelled && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-600">{t("statusCancelled")}</span>
            )}
          </div>
          <p className="text-gray-500 text-sm">{t("createdOn")} {formatDate(order.created_at, locale)}</p>

          {/* Smart buttons : factures & livraisons liées */}
          {(invoiceCount > 0 || deliveryCount > 0) && (
            <div className="flex items-center gap-2 mt-3">
              {invoiceCount > 0 && (
                <Link
                  href={firstInvoiceId ? `/${locale}/ventes/factures/${firstInvoiceId}` : `/${locale}/ventes/factures`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-sm text-gray-700 transition-colors shadow-sm"
                >
                  <Receipt className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-blue-600">{invoiceCount}</span>
                  <span>{t("invoice")}{invoiceCount > 1 ? t("invoicePlural") : ""}</span>
                </Link>
              )}
              {deliveryCount > 0 && (
                <Link
                  href={`/${locale}/ventes/bons-livraison?order=${order.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-sm text-gray-700 transition-colors shadow-sm"
                >
                  <Truck className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-emerald-600">{deliveryCount}</span>
                  <span>{t("delivery")}{deliveryCount > 1 ? t("deliveryPlural") : ""}</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap justify-end">
          <a
            href={`/${locale}/ventes/devis/${order.id}/pdf`}
            target="_blank"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" /> {t("printPdf")}
          </a>
          {order.status === "confirmed" && (
            <a
              href={`/${locale}/ventes/devis/${order.id}/bon-livraison`}
              target="_blank"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <Receipt className="w-4 h-4" /> {t("deliverySlip")}
            </a>
          )}

          {/* Remettre en brouillon : depuis confirmed, invoiced, cancelled */}
          {["confirmed", "invoiced", "cancelled"].includes(order.status) && (
            <Button variant="secondary" onClick={resetToDraft} disabled={loading}>
              <RotateCcw className="w-4 h-4" /> {t("resetToDraft")}
            </Button>
          )}
          {/* Annuler : depuis draft, confirmed, invoiced */}
          {["draft", "confirmed", "invoiced"].includes(order.status) && (
            <Button variant="danger" onClick={cancel} disabled={loading}>
              <X className="w-4 h-4" /> {t("cancel")}
            </Button>
          )}
          {order.status === "draft" && (
            <Button onClick={confirm} disabled={loading}>
              <CheckCircle className="w-4 h-4" /> {t("confirm")}
            </Button>
          )}
          {order.status === "confirmed" && (
            <Button onClick={createInvoice} disabled={loading}>
              <Receipt className="w-4 h-4" /> {loading ? t("creating") : t("createInvoice")}
            </Button>
          )}
        </div>
      </div>

      {/* Stepper Odoo style */}
      {!isCancelled && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex items-center">
            {STEPS.map((step, i) => {
              const isActive = i === stepIndex
              const isDone = i < stepIndex
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    isActive ? "text-blue-600" : isDone ? "text-gray-700" : "text-gray-400"
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 transition-colors ${
                      isActive
                        ? "border-blue-600 bg-blue-600 text-white"
                        : isDone
                        ? "border-gray-400 bg-gray-400 text-white"
                        : "border-gray-200 bg-white text-gray-400"
                    }`}>
                      {isDone ? "✓" : i + 1}
                    </div>
                    <span>{step.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 ${i < stepIndex ? "bg-gray-400" : "bg-gray-200"}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Infos client */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <Field label={t("fieldClient")} value={order.account?.name} />
            {order.contact && (
              <Field label={t("fieldContact")} value={`${order.contact.first_name} ${order.contact.last_name}`} />
            )}
            {order.salesperson && (
              <Field label={t("fieldSalesperson")} value={order.salesperson.full_name} />
            )}
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t("fieldClientRef")}</p>
              {isDraft ? (
                <input
                  className="w-full text-sm text-gray-900 bg-transparent border-b border-gray-200 hover:border-gray-400 focus:border-blue-500 focus:outline-none py-0.5"
                  value={orderFields.client_order_ref}
                  onChange={e => setOrderFields(p => ({ ...p, client_order_ref: e.target.value }))}
                  onBlur={e => updateOrderField("client_order_ref", e.target.value)}
                  placeholder="Réf. commande client..."
                />
              ) : (
                <p className="text-sm text-gray-900 font-mono">{order.client_order_ref ?? "—"}</p>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <Field label={t("fieldOrderDate")} value={order.date_order ? formatDate(order.date_order, locale) : formatDate(order.created_at, locale)} />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t("fieldExpiry")}</p>
              {isDraft ? (
                <input
                  type="date"
                  className="text-sm text-gray-900 bg-transparent border-b border-gray-200 hover:border-gray-400 focus:border-blue-500 focus:outline-none py-0.5"
                  value={orderFields.valid_until}
                  onChange={e => setOrderFields(p => ({ ...p, valid_until: e.target.value }))}
                  onBlur={e => updateOrderField("valid_until", e.target.value)}
                />
              ) : (
                <p className="text-sm text-gray-900">{order.valid_until ? formatDate(order.valid_until, locale) : "—"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t("fieldPaymentTerms")}</p>
              {isDraft ? (
                <select
                  className="text-sm text-gray-900 bg-transparent border-b border-gray-200 hover:border-gray-400 focus:border-blue-500 focus:outline-none py-0.5 w-full"
                  value={orderFields.payment_terms}
                  onChange={e => { setOrderFields(p => ({ ...p, payment_terms: e.target.value })); updateOrderField("payment_terms", e.target.value) }}
                >
                  <option value="">— Choisir —</option>
                  {Object.entries(PAYMENT_TERMS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-900">{order.payment_terms ? (PAYMENT_TERMS_LABELS[order.payment_terms] ?? order.payment_terms) : "—"}</p>
              )}
            </div>
            <Field label={t("fieldCurrency")} value={order.currency} />
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "lines" && (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t("colDescription")}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colQty")}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colUnitPrice")}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colDiscount")} %</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colStock")}</th>
                  {tva && <th className="text-center px-4 py-3 font-medium text-gray-600 text-xs">Sans TVA</th>}
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colSubtotal")}</th>
                  {isDraft && <th className="px-2 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lines.map(l => (
                  <tr key={l.id} className={l.tva_exempt ? "bg-gray-50/50" : ""}>
                    <td className="px-4 py-2">
                      {isDraft ? (
                        <div className="relative">
                          <input
                            className="w-full text-sm font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-0.5"
                            value={productSearch[l.id] !== undefined ? productSearch[l.id] : l.description}
                            onChange={e => setProductSearch(prev => ({ ...prev, [l.id]: e.target.value }))}
                            onBlur={e => {
                              if (!productSearch[l.id]) return
                              updateLine(l.id, "description", e.target.value)
                              setTimeout(() => setProductSearch(prev => { const n = { ...prev }; delete n[l.id]; return n }), 200)
                            }}
                            placeholder="Description ou produit..."
                          />
                          {productSearch[l.id] && productSearch[l.id].length > 0 && (() => {
                            const q = productSearch[l.id].toLowerCase()
                            const matches = allProducts.filter(p =>
                              p.name.toLowerCase().includes(q) || (p.reference ?? "").toLowerCase().includes(q)
                            ).slice(0, 8)
                            return matches.length > 0 ? (
                              <div className="absolute z-20 left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                                {matches.map(p => (
                                  <button
                                    key={p.id}
                                    onMouseDown={() => selectProduct(l.id, p.id)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2"
                                  >
                                    <span className="font-medium text-gray-900 truncate">{p.name}</span>
                                    <span className="text-gray-400 text-xs shrink-0">
                                      {p.sale_price != null ? `${formatNumber(p.sale_price)}` : ""}
                                      {p.reference ? ` · ${p.reference}` : ""}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : null
                          })()}
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900">{l.description}</p>
                          {l.product?.reference && <p className="text-xs text-gray-400 font-mono">{l.product.reference}</p>}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isDraft ? (
                        <input
                          type="number" min="0" step="any"
                          className="w-20 text-sm text-right text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-0.5"
                          defaultValue={l.quantity}
                          onBlur={e => updateLine(l.id, "quantity", e.target.value)}
                        />
                      ) : (
                        <span className="text-gray-700">{formatNumber(l.quantity)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isDraft ? (
                        <input
                          type="number" min="0" step="any"
                          className="w-24 text-sm text-right text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-0.5"
                          defaultValue={l.unit_price}
                          onBlur={e => updateLine(l.id, "unit_price", e.target.value)}
                        />
                      ) : (
                        <span className="text-gray-700">{formatNumber(l.unit_price)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isDraft ? (
                        <input
                          type="number" min="0" max="100" step="any"
                          className="w-16 text-sm text-right text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-0.5"
                          defaultValue={l.discount}
                          onBlur={e => updateLine(l.id, "discount", e.target.value)}
                        />
                      ) : (
                        <span className="text-gray-500">{l.discount > 0 ? `${l.discount}%` : "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {(() => {
                        const pid = (l as unknown as { product_id: string }).product_id
                        const status = getStockStatus(pid, l.quantity)
                        if (!pid) return <span className="text-gray-300 text-xs">—</span>
                        if (status === "ok") return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">✓ {t("stockOk")}</span>
                        if (status === "low") return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">⚠ {t("stockLow")}</span>
                        return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">✗ {t("stockNone")}</span>
                      })()}
                    </td>
                    {tva && (
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => toggleLineExempt(l.id)}
                          title={l.tva_exempt ? "Cliquer pour appliquer la TVA" : "Cliquer pour exempter de TVA"}
                          className={`w-8 h-4 rounded-full transition-colors relative inline-flex items-center ${l.tva_exempt ? "bg-amber-400" : "bg-gray-200"}`}
                        >
                          <span className={`absolute w-3 h-3 rounded-full bg-white shadow transition-transform ${l.tva_exempt ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">
                      {formatNumber(lineTotal(l))}
                    </td>
                    {isDraft && (
                      <td className="px-2 py-2">
                        <button
                          onClick={() => deleteLine(l.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {isDraft && (
              <div className="px-4 py-3 border-t border-gray-50">
                <button
                  onClick={addLine}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter une ligne
                </button>
              </div>
            )}

            <div className="border-t border-gray-100 px-6 py-4 flex items-start justify-between gap-4">
              {/* Toggle TVA global */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTva}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${tva ? "bg-blue-600" : "bg-gray-200"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${tva ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <span className="text-sm text-gray-600">TVA 18%</span>
              </div>

              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{t("totalHT")}</span>
                  <span className="font-semibold text-gray-900">{formatNumber(total)} {order.currency}</span>
                </div>
                {tva && (
                  <>
                    {lines.some(l => l.tva_exempt) && (
                      <div className="flex justify-between text-xs text-amber-600">
                        <span>Base taxable</span>
                        <span>{formatNumber(totalTaxable)} {order.currency}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>TVA 18%</span>
                      <span className="font-semibold text-gray-900">{formatNumber(tvaAmount)} {order.currency}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-2">
                      <span>Total TTC</span>
                      <span>{formatNumber(totalTTC)} {order.currency}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "other" && (
          <div className="p-6 text-sm text-gray-500">
            {t("noAdditionalInfo")}
          </div>
        )}

        {activeTab === "notes" && (
          <div className="p-6">
            {order.notes ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">{t("noNotes")}</p>
            )}
          </div>
        )}
      </div>

      {/* Zone d'impression */}
      <div className="print-root hidden print:block">
        <DocumentLayout
          type="devis"
          number={order.number}
          date={order.created_at}
          validUntil={order.valid_until ?? undefined}
          settings={docSettings}
          recipientName={order.account?.name ?? "—"}
          recipientCountry={order.account?.country ?? undefined}
          lines={order.lines}
          notes={order.notes ?? undefined}
          currency={order.currency}
          locale={locale}
        />
      </div>
    </div>
  )
}

function Field({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-semibold text-gray-900 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
    </div>
  )
}
