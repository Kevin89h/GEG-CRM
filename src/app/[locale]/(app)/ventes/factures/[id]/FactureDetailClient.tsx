"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Send, Printer, CheckCircle, ArrowLeft, Truck, RotateCcw, X } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Modal } from "@/components/ui/Modal"
import { createClient } from "@/lib/supabase/client"
import { formatDate, formatCurrency, formatNumber } from "@/lib/utils"
import DocumentLayout from "@/components/print/DocumentLayout"

interface Line {
  id: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  discount: number
  tva_rate?: number | null
}

interface Payment {
  id: string
  amount: number
  currency: string
  method: string
  reference: string | null
  notes: string | null
  paid_at: string
}

interface TreasuryAccount { id: string; name: string; type: string; currency: string }
interface Warehouse { id: string; name: string; city: string | null }
interface DeliveryNote { id: string; number: string; status: string; delivery_date: string | null }

interface Invoice {
  id: string
  number: string
  status: string
  currency: string
  issue_date: string
  due_date: string | null
  notes: string | null
  total_ht: number
  total_paid: number
  balance: number
  account: { name: string; country: string | null } | null
  lines: Line[]
  payments: Payment[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { invoice: Invoice; locale: string; treasuryAccounts: TreasuryAccount[]; warehouses: Warehouse[]; deliveryNotes: DeliveryNote[]; docSettings?: Record<string, any> }

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-amber-100 text-amber-700",
  partial: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
}

export default function FactureDetailClient({ invoice: initial, locale, treasuryAccounts, warehouses, deliveryNotes: initialDNs, docSettings = {} }: Props) {
  const router = useRouter()
  const t = useTranslations("factures")
  const [invoice, setInvoice] = useState(initial)
  const [deliveryNotes, setDeliveryNotes] = useState(initialDNs)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [creatingBL, setCreatingBL] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    amount: String(Math.max(invoice.balance, 0).toFixed(2)),
    currency: invoice.currency,
    method: "bank" as string,
    treasury_account_id: treasuryAccounts[0]?.id ?? "",
    reference: "",
    notes: "",
    paid_at: new Date().toISOString().split("T")[0],
  })

  const statusLabel: Record<string, string> = {
    draft: t("statusDraft"), sent: t("statusSent"), partial: t("statusPartial"), paid: t("statusPaid"), cancelled: t("statusCancelled"),
  }
  const methodLabel: Record<string, string> = {
    cash: t("methodCash"), bank: t("methodBank"), mobile: t("methodMobile"), cheque: t("methodCheque"), other: t("methodOther"),
  }

  function lineTotal(l: Line) {
    return l.quantity * l.unit_price * (1 - l.discount / 100)
  }

  const totalHT = invoice.lines.reduce((s, l) => s + lineTotal(l), 0)
  const totalTVA = invoice.lines.reduce((s, l) => {
    const rate = l.tva_rate ?? 0
    return s + (rate > 0 ? lineTotal(l) * rate / 100 : 0)
  }, 0)
  const totalTTC = totalHT + totalTVA
  const hasTva = totalTVA > 0

  const isPaid = invoice.status === "paid"
  const isCancelled = invoice.status === "cancelled"
  const isDraft = invoice.status === "draft"
  const canEdit = !isCancelled

  async function updateLine(lineId: string, field: keyof Line, value: string | number) {
    const numVal = ["quantity", "unit_price", "discount", "tva_rate"].includes(field as string)
      ? (typeof value === "number" ? value : parseFloat(value as string) || 0)
      : undefined
    const payload = numVal !== undefined ? { [field]: numVal } : { [field]: value }
    await fetch(`/api/invoices/${invoice.id}/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setInvoice(prev => ({
      ...prev,
      lines: prev.lines.map(l => l.id === lineId ? { ...l, ...payload } : l),
    }))
  }

  async function toggleLineTva(lineId: string, currentRate: number | null | undefined) {
    const newRate = (currentRate ?? 0) > 0 ? 0 : 18
    await updateLine(lineId, "tva_rate", newRate)
  }

  async function toggleAllTva() {
    const newRate = hasTva ? 0 : 18
    await fetch(`/api/invoices/${invoice.id}/tva`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tva_rate: newRate }),
    })
    setInvoice(prev => ({
      ...prev,
      lines: prev.lines.map(l => ({ ...l, tva_rate: newRate })),
    }))
  }

  async function deleteLine(lineId: string) {
    await fetch(`/api/invoices/${invoice.id}/lines/${lineId}`, { method: "DELETE" })
    setInvoice(prev => ({ ...prev, lines: prev.lines.filter(l => l.id !== lineId) }))
  }

  async function addLine() {
    const position = invoice.lines.length
    const defaultTvaRate = hasTva ? 18 : 0
    const res = await fetch(`/api/invoices/${invoice.id}/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "", quantity: 1, unit_price: 0, discount: 0, position, tva_rate: defaultTvaRate }),
    })
    const json = await res.json()
    if (json.line) setInvoice(prev => ({ ...prev, lines: [...prev.lines, json.line as Line] }))
  }

  async function updateStatus(status: string) {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/invoices/${invoice.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error ?? t("serverError"))
      setSaving(false)
      return
    }
    setInvoice(prev => ({ ...prev, status }))
    setConfirmModalOpen(false)
    setSaving(false)
  }

  async function confirmAndSend() { await updateStatus("sent") }
  async function resetToDraft() { await updateStatus("draft") }

  async function cancelInvoice() {
    if (!window.confirm(t("confirmCancelInvoice"))) return
    await updateStatus("cancelled")
  }

  const hasStockLines = invoice.lines.some(l => l.product_id)

  async function createDeliveryNote() {
    setCreatingBL(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError("Non authentifié"); setCreatingBL(false); return }

      const accountId = invoice.account ? (invoice as unknown as Record<string, unknown>).account_id as string : null
      const res = await fetch(`/api/factures/${invoice.id}/create-delivery-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          accountId,
          lines: invoice.lines.map(l => ({
            product_id: l.product_id ?? null,
            description: l.description,
            quantity: l.quantity,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Erreur lors de la création du bon de livraison")
        setCreatingBL(false)
        return
      }
      router.push(`/${locale}/ventes/bons-livraison/${json.deliveryNoteId}`)
    } catch {
      setError("Erreur inattendue")
      setCreatingBL(false)
    }
  }

  async function savePayment() {
    const amount = parseFloat(paymentForm.amount)
    if (!amount || amount <= 0) { setError(t("invalidAmount")); return }

    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError(t("notAuthenticated")); setSaving(false); return }

    const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        currency: paymentForm.currency,
        method: paymentForm.method,
        treasury_account_id: paymentForm.treasury_account_id || null,
        reference: paymentForm.reference || null,
        notes: paymentForm.notes || null,
        paid_at: paymentForm.paid_at,
        user_id: user.id,
      }),
    })

    const json = await res.json()
    if (!res.ok || !json.payment) { setError(json.error ?? t("serverError")); setSaving(false); return }

    const newTotalPaid = invoice.total_paid + amount
    const newBalance = invoice.total_ht - newTotalPaid
    const newStatus = newBalance <= 0 ? "paid" : newTotalPaid > 0 ? "partial" : "sent"

    setInvoice(prev => ({
      ...prev,
      total_paid: newTotalPaid,
      balance: newBalance,
      status: newStatus,
      payments: [json.payment, ...prev.payments],
    }))
    setModalOpen(false)
    setPaymentForm(f => ({ ...f, amount: String(Math.max(newBalance, 0).toFixed(2)) }))
    setSaving(false)
  }

  const progressPct = invoice.total_ht > 0
    ? Math.min(100, (invoice.total_paid / invoice.total_ht) * 100)
    : 0

  // Stepper Odoo-style
  const STEPS = [
    { key: "draft", label: t("stepDraft") },
    { key: "sent", label: t("stepAccounted") },
    { key: "partial", label: t("stepPartiallySettled") },
    { key: "paid", label: t("stepPaid") },
  ]
  function getStepIndex(s: string) {
    if (s === "draft") return 0
    if (s === "sent") return 1
    if (s === "partial") return 2
    if (s === "paid") return 3
    return -1
  }
  const stepIndex = getStepIndex(invoice.status)

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/${locale}/ventes/factures`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("backToInvoices")}
      </Link>

      {/* Barre d'actions style Odoo */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Boutons gauche */}
        <div className="flex flex-wrap items-center gap-2">
          {["sent", "partial", "paid", "cancelled"].includes(invoice.status) && (
            <Button variant="secondary" onClick={resetToDraft} disabled={saving}>
              <RotateCcw className="w-4 h-4" /> {t("resetToDraft")}
            </Button>
          )}
          {["draft", "sent", "partial"].includes(invoice.status) && (
            <Button variant="danger" onClick={cancelInvoice} disabled={saving}>
              <X className="w-4 h-4" /> {t("cancel")}
            </Button>
          )}
          {invoice.status === "draft" && (
            <Button onClick={() => setConfirmModalOpen(true)} disabled={saving}>
              <Send className="w-4 h-4" /> {t("confirmAndSend")}
            </Button>
          )}
          {!isPaid && !isCancelled && invoice.status !== "draft" && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4" /> {t("registerPayment")}
            </Button>
          )}
          {isPaid && (
            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
              <CheckCircle className="w-4 h-4" /> {t("settled")}
            </div>
          )}
        </div>

        {/* Stepper droite */}
        {isCancelled ? (
          <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-red-100 text-red-700 border border-red-200">
            {t("statusCancelled")}
          </span>
        ) : (
          <div className="flex items-center gap-1 overflow-x-auto">
            {STEPS.map((step, i) => {
              const isActive = i === stepIndex
              const isDone = i < stepIndex
              return (
                <div key={step.key} className="flex items-center">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isDone
                      ? "bg-gray-200 text-gray-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    {isDone && <span>✓</span>}
                    {step.label}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-4 h-px mx-0.5 ${i < stepIndex ? "bg-gray-400" : "bg-gray-200"}`} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 font-mono mb-0.5">{invoice.number}</h1>
          <p className="text-gray-500 text-sm">{invoice.account?.name ?? "—"}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/${locale}/ventes/factures/${invoice.id}/pdf`} target="_blank" className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            <Printer className="w-4 h-4" /> {t("printPdf")}
          </a>
          {!isCancelled && invoice.status !== "draft" && (
            <Button variant="secondary" onClick={createDeliveryNote} disabled={creatingBL}>
              <Truck className="w-4 h-4" /> {creatingBL ? t("creating") : t("deliveryNote")}
            </Button>
          )}
        </div>
      </div>

      {/* Barre de progression paiement */}
      {invoice.status !== "draft" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">{t("paymentProgress")}</span>
            <span className="font-medium text-gray-900">{progressPct.toFixed(0)}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all ${isPaid ? "bg-emerald-500" : "bg-blue-500"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t("totalHt")}</p>
              <p className="font-bold text-gray-900">{formatCurrency(invoice.total_ht, invoice.currency as "USD" | "GNF" | "EUR")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t("collected")}</p>
              <p className="font-bold text-emerald-600">{formatCurrency(invoice.total_paid, invoice.currency as "USD" | "GNF" | "EUR")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t("remaining")}</p>
              <p className={`font-bold ${invoice.balance > 0 ? "text-red-600" : "text-gray-400"}`}>
                {formatCurrency(Math.max(invoice.balance, 0), invoice.currency as "USD" | "GNF" | "EUR")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info facture */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-6 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{t("issueDate")}</p>
            <p className="font-semibold text-gray-900">{formatDate(invoice.issue_date, locale)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{t("dueDate")}</p>
            <p className={`font-semibold ${invoice.due_date && new Date(invoice.due_date) < new Date() && !isPaid ? "text-red-600" : "text-gray-900"}`}>
              {invoice.due_date ? formatDate(invoice.due_date, locale) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{t("currency")}</p>
            <p className="font-semibold text-gray-900">{invoice.currency}</p>
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("colDescription")}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colQty")}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">{t("colUnitPrice")}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">{t("colDiscount")}</th>
              {canEdit && <th className="text-center px-2 py-3 font-medium text-gray-600 hidden sm:table-cell">TVA</th>}
              <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colTotalHt")}</th>
              {canEdit && <th className="w-8" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoice.lines.map(l => (
              <tr key={l.id} className="group">
                <td className="px-4 py-2">
                  {canEdit ? (
                    <input
                      defaultValue={l.description}
                      onBlur={e => updateLine(l.id, "description", e.target.value)}
                      className="w-full font-medium text-gray-900 outline-none border-b border-transparent focus:border-blue-400 bg-transparent py-0.5"
                    />
                  ) : (
                    <span className="font-medium text-gray-900">{l.description}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {canEdit ? (
                    <input type="number" min="0" step="any" defaultValue={l.quantity}
                      onBlur={e => updateLine(l.id, "quantity", e.target.value)}
                      className="w-20 text-right text-gray-700 outline-none border-b border-transparent focus:border-blue-400 bg-transparent py-0.5"
                    />
                  ) : <span className="text-gray-700">{formatNumber(l.quantity)}</span>}
                </td>
                <td className="px-4 py-2 text-right hidden sm:table-cell">
                  {canEdit ? (
                    <input type="number" min="0" step="any" defaultValue={l.unit_price}
                      onBlur={e => updateLine(l.id, "unit_price", e.target.value)}
                      className="w-28 text-right text-gray-700 outline-none border-b border-transparent focus:border-blue-400 bg-transparent py-0.5"
                    />
                  ) : <span className="text-gray-700">{formatNumber(l.unit_price, 2)}</span>}
                </td>
                <td className="px-4 py-2 text-right hidden sm:table-cell">
                  {canEdit ? (
                    <input type="number" min="0" max="100" step="0.1" defaultValue={l.discount}
                      onBlur={e => updateLine(l.id, "discount", e.target.value)}
                      className="w-16 text-right text-gray-500 outline-none border-b border-transparent focus:border-blue-400 bg-transparent py-0.5"
                    />
                  ) : <span className="text-gray-500">{l.discount > 0 ? `${l.discount}%` : "—"}</span>}
                </td>
                {canEdit && (
                  <td className="px-2 py-2 text-center hidden sm:table-cell">
                    <button
                      onClick={() => toggleLineTva(l.id, l.tva_rate)}
                      title={(l.tva_rate ?? 0) > 0 ? "TVA 18% — cliquer pour exempter" : "Sans TVA — cliquer pour activer"}
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold border transition-colors ${
                        (l.tva_rate ?? 0) > 0
                          ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                          : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                      }`}
                    >
                      {(l.tva_rate ?? 0) > 0 ? `${l.tva_rate}%` : "—"}
                    </button>
                  </td>
                )}
                <td className="px-4 py-2 text-right font-semibold text-gray-900">
                  {formatNumber(lineTotal(l), 2)}
                </td>
                {canEdit && (
                  <td className="pr-2 py-2">
                    <button onClick={() => deleteLine(l.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {canEdit && (
          <div className="px-4 py-2 border-t border-gray-50 flex items-center justify-between">
            <button onClick={addLine} className="text-sm text-blue-600 hover:text-blue-500 font-medium transition-colors">
              + Ajouter une ligne
            </button>
            <button
              onClick={toggleAllTva}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                hasTva
                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {hasTva ? "TVA 18% activée — désactiver" : "Activer TVA 18%"}
            </button>
          </div>
        )}
        <div className="border-t border-gray-100 px-4 py-3 flex flex-col items-end gap-1 text-sm">
          <div className="flex gap-8 text-gray-600">
            <span>{t("totalHtLabel")}</span>
            <span className="font-medium text-gray-900">{formatCurrency(totalHT, invoice.currency as "USD" | "GNF" | "EUR")}</span>
          </div>
          {hasTva && (
            <div className="flex gap-8 text-gray-600">
              <span>TVA (18%)</span>
              <span className="font-medium text-gray-900">{formatCurrency(totalTVA, invoice.currency as "USD" | "GNF" | "EUR")}</span>
            </div>
          )}
          {hasTva && (
            <div className="flex gap-8 font-bold text-gray-900 text-base pt-1 border-t border-gray-200 mt-1">
              <span>Total TTC</span>
              <span>{formatCurrency(totalTTC, invoice.currency as "USD" | "GNF" | "EUR")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Historique des paiements */}
      {invoice.payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <h2 className="font-semibold text-gray-800 px-5 py-4 border-b border-gray-50">{t("paymentsReceived")}</h2>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("colDate")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("colMethod")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">{t("colReference")}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colAmount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoice.payments.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-gray-600">{formatDate(p.paid_at, locale)}</td>
                  <td className="px-4 py-3 text-gray-600">{methodLabel[p.method] ?? p.method}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden sm:table-cell">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    +{formatCurrency(p.amount, p.currency as "USD" | "GNF" | "EUR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Bons de livraison liés */}
      {deliveryNotes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <h2 className="font-semibold text-gray-800 px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <Truck className="w-4 h-4 text-gray-400" /> {t("deliveryNotes")}
          </h2>
          <div className="divide-y divide-gray-50">
            {deliveryNotes.map(dn => (
              <div key={dn.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium text-gray-900">{dn.number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    dn.status === "delivered" ? "bg-emerald-100 text-emerald-700"
                    : dn.status === "cancelled" ? "bg-red-100 text-red-600"
                    : "bg-gray-100 text-gray-600"
                  }`}>
                    {dn.status === "delivered" ? t("dnDelivered") : dn.status === "cancelled" ? t("dnCancelled") : t("dnInProgress")}
                  </span>
                  {dn.delivery_date && (
                    <span className="text-xs text-gray-400">{formatDate(dn.delivery_date, locale)}</span>
                  )}
                </div>
                <Link
                  href={`/${locale}/ventes/bons-livraison/${dn.id}`}
                  className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                >
                  {t("open")} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {invoice.notes && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{t("notes")}</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Modal confirmation */}
      <Modal open={confirmModalOpen} onClose={() => { setConfirmModalOpen(false); setError(null) }} title={t("confirmInvoiceTitle")}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {t("confirmInvoiceBody1")} <strong>{t("stepAccounted")}</strong>. {t("confirmInvoiceBody2")}
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setConfirmModalOpen(false); setError(null) }}>{t("cancel")}</Button>
            <Button onClick={confirmAndSend} disabled={saving}>
              {saving ? t("confirming") : t("confirmInvoiceBtn")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal paiement — style Odoo */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("payModalTitle")}>
        <div className="space-y-0">
          {/* Grille 2 colonnes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 py-2">
            {/* Colonne gauche */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("journal")}</p>
                {treasuryAccounts.length > 0 ? (
                  <select
                    value={paymentForm.treasury_account_id}
                    onChange={e => setPaymentForm(f => ({ ...f, treasury_account_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                  >
                    <option value="">— {t("noJournal")} —</option>
                    {treasuryAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-400 italic">{t("noAccountConfigured")}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("paymentMethod")}</p>
                <select
                  value={paymentForm.method}
                  onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                >
                  <option value="bank">{t("methodBankTransfer")}</option>
                  <option value="cash">{t("methodCash")}</option>
                  <option value="mobile">{t("methodOrangeMoney")}</option>
                  <option value="cheque">{t("methodCheque")}</option>
                  <option value="other">{t("methodOther")}</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("reference")}</p>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder={invoice.number}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                />
              </div>
            </div>

            {/* Colonne droite */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("amount")}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-gray-900"
                  />
                  <select
                    value={paymentForm.currency}
                    onChange={e => setPaymentForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                  >
                    <option value="GNF">GNF</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("settlementDate")}</p>
                <input
                  type="date"
                  value={paymentForm.paid_at}
                  onChange={e => setPaymentForm(f => ({ ...f, paid_at: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("memo")}</p>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={invoice.number}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                />
              </div>
            </div>
          </div>

          {invoice.balance > 0 && parseFloat(paymentForm.amount) < invoice.balance && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 mt-3">
              {t("partialPaymentWarning")}{" "}
              <strong>{formatCurrency(invoice.balance - (parseFloat(paymentForm.amount) || 0), invoice.currency as "USD" | "GNF" | "EUR")}</strong>{" "}
              {t("partialPaymentWarningAfter")}
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

          <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
            <Button onClick={savePayment} disabled={saving}>
              {saving ? t("saving") : t("createPayment")}
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("ignore")}</Button>
          </div>
        </div>
      </Modal>

      {/* Zone d'impression — masquée à l'écran */}
      <div className="print-root hidden print:block">
        <DocumentLayout
          type="facture"
          number={invoice.number}
          date={invoice.issue_date ?? new Date().toISOString()}
          dueDate={invoice.due_date ?? undefined}
          settings={docSettings}
          recipientName={invoice.account?.name ?? "—"}
          recipientCountry={invoice.account?.country ?? undefined}
          lines={invoice.lines.map(l => ({
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount: l.discount,
          }))}
          notes={invoice.notes ?? undefined}
          currency={invoice.currency}
          locale={locale}
        />
      </div>
    </div>
  )
}
