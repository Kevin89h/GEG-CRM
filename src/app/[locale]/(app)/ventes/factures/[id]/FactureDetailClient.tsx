"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Send, Printer, CheckCircle, ArrowLeft, Package, Truck, RotateCcw, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Modal } from "@/components/ui/Modal"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatDate, formatCurrency, formatNumber } from "@/lib/utils"
import DocumentLayout from "@/components/print/DocumentLayout"

interface Line {
  id: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  discount: number
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

const statusLabel: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyée", partial: "Paiement partiel", paid: "Payée", cancelled: "Annulée",
}
const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-amber-100 text-amber-700",
  partial: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
}
const methodLabel: Record<string, string> = {
  cash: "Espèces", bank: "Virement", mobile: "Mobile money", cheque: "Chèque", other: "Autre",
}

export default function FactureDetailClient({ invoice: initial, locale, treasuryAccounts, warehouses, deliveryNotes: initialDNs, docSettings = {} }: Props) {
  const router = useRouter()
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

  function lineTotal(l: Line) {
    return l.quantity * l.unit_price * (1 - l.discount / 100)
  }

  const isPaid = invoice.status === "paid"
  const isCancelled = invoice.status === "cancelled"

  async function confirmAndSend() {
    setSaving(true)
    setError(null)
    const { db } = getCompanyClientBrowser()
    const { error: err } = await db.from("invoices").update({ status: "sent" }).eq("id", invoice.id)
    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }
    setInvoice(prev => ({ ...prev, status: "sent" }))
    setConfirmModalOpen(false)
    setSaving(false)
  }

  async function resetToDraft() {
    setSaving(true)
    setError(null)
    const { db } = getCompanyClientBrowser()
    await db.from("invoices").update({ status: "draft" }).eq("id", invoice.id)
    setInvoice(prev => ({ ...prev, status: "draft" }))
    setSaving(false)
  }

  async function cancelInvoice() {
    if (!window.confirm("Annuler cette facture ?")) return
    setSaving(true)
    setError(null)
    const { db } = getCompanyClientBrowser()
    await db.from("invoices").update({ status: "cancelled" }).eq("id", invoice.id)
    setInvoice(prev => ({ ...prev, status: "cancelled" }))
    setSaving(false)
  }

  const hasStockLines = invoice.lines.some(l => l.product_id)

  async function createDeliveryNote() {
    setCreatingBL(true)
    const { supabase, db } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreatingBL(false); return }

    const { data: dn } = await supabase
      .from("delivery_notes")
      .insert([{
        number: "",
        invoice_id: invoice.id,
        account_id: invoice.account ? (invoice as unknown as Record<string, unknown>).account_id as string : null,
        status: "draft",
        user_id: user.id,
      }])
      .select("id")
      .single()

    if (!dn) { setCreatingBL(false); return }

    // Copier les lignes de la facture
    await db.from("delivery_note_lines").insert(
      invoice.lines.map((l, i) => ({
        delivery_note_id: dn.id,
        product_id: l.product_id ?? null,
        description: l.description,
        quantity: l.quantity,
        position: i,
      }))
    )

    router.push(`/${locale}/ventes/bons-livraison/${dn.id}`)
  }

  async function savePayment() {
    const amount = parseFloat(paymentForm.amount)
    if (!amount || amount <= 0) { setError("Montant invalide"); return }

    setSaving(true)
    setError(null)
    const { supabase, db } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError("Non authentifié"); setSaving(false); return }

    const { data: payment, error: err } = await supabase
      .from("payments")
      .insert([{
        invoice_id: invoice.id,
        amount,
        currency: paymentForm.currency,
        method: paymentForm.method,
        treasury_account_id: paymentForm.treasury_account_id || null,
        reference: paymentForm.reference || null,
        notes: paymentForm.notes || null,
        paid_at: new Date(paymentForm.paid_at).toISOString(),
        user_id: user.id,
      }])
      .select("*")
      .single()

    if (err || !payment) { setError(err?.message ?? "Erreur"); setSaving(false); return }

    // Mise à jour locale optimiste
    const newTotalPaid = invoice.total_paid + amount
    const newBalance = invoice.total_ht - newTotalPaid
    const newStatus = newBalance <= 0 ? "paid" : newTotalPaid > 0 ? "partial" : "sent"

    setInvoice(prev => ({
      ...prev,
      total_paid: newTotalPaid,
      balance: newBalance,
      status: newStatus,
      payments: [{ ...payment }, ...prev.payments],
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
    { key: "draft", label: "Brouillon" },
    { key: "sent", label: "Comptabilisé" },
    { key: "partial", label: "Partiellement réglée" },
    { key: "paid", label: "Payée" },
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
        <ArrowLeft className="w-4 h-4" /> Retour aux factures
      </Link>

      {/* Barre d'actions style Odoo */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 mb-4 flex items-center justify-between gap-3">
        {/* Boutons gauche */}
        <div className="flex items-center gap-2">
          {["sent", "partial", "paid", "cancelled"].includes(invoice.status) && (
            <Button variant="secondary" onClick={resetToDraft} disabled={saving}>
              <RotateCcw className="w-4 h-4" /> Remettre en brouillon
            </Button>
          )}
          {["draft", "sent", "partial"].includes(invoice.status) && (
            <Button variant="danger" onClick={cancelInvoice} disabled={saving}>
              <X className="w-4 h-4" /> Annuler
            </Button>
          )}
          {invoice.status === "draft" && (
            <Button onClick={() => setConfirmModalOpen(true)} disabled={saving}>
              <Send className="w-4 h-4" /> Confirmer & envoyer
            </Button>
          )}
          {!isPaid && !isCancelled && invoice.status !== "draft" && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4" /> Enregistrer un paiement
            </Button>
          )}
          {isPaid && (
            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
              <CheckCircle className="w-4 h-4" /> Soldée
            </div>
          )}
        </div>

        {/* Stepper droite */}
        {isCancelled ? (
          <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-red-100 text-red-700 border border-red-200">
            Annulée
          </span>
        ) : (
          <div className="flex items-center gap-1">
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
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono mb-0.5">{invoice.number}</h1>
          <p className="text-gray-500 text-sm">{invoice.account?.name ?? "—"}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/${locale}/ventes/factures/${invoice.id}/pdf`} target="_blank" className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            <Printer className="w-4 h-4" /> PDF / Imprimer
          </a>
          {!isCancelled && invoice.status !== "draft" && (
            <Button variant="secondary" onClick={createDeliveryNote} disabled={creatingBL}>
              <Truck className="w-4 h-4" /> {creatingBL ? "Création…" : "Bon de livraison"}
            </Button>
          )}
        </div>
      </div>

      {/* Barre de progression paiement */}
      {invoice.status !== "draft" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Progression du paiement</span>
            <span className="font-medium text-gray-900">{progressPct.toFixed(0)}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all ${isPaid ? "bg-emerald-500" : "bg-blue-500"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Total HT</p>
              <p className="font-bold text-gray-900">{formatCurrency(invoice.total_ht, invoice.currency as "USD" | "GNF" | "EUR")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Encaissé</p>
              <p className="font-bold text-emerald-600">{formatCurrency(invoice.total_paid, invoice.currency as "USD" | "GNF" | "EUR")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Restant dû</p>
              <p className={`font-bold ${invoice.balance > 0 ? "text-red-600" : "text-gray-400"}`}>
                {formatCurrency(Math.max(invoice.balance, 0), invoice.currency as "USD" | "GNF" | "EUR")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info facture */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Date d'émission</p>
            <p className="font-semibold text-gray-900">{formatDate(invoice.issue_date, locale)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Échéance</p>
            <p className={`font-semibold ${invoice.due_date && new Date(invoice.due_date) < new Date() && !isPaid ? "text-red-600" : "text-gray-900"}`}>
              {invoice.due_date ? formatDate(invoice.due_date, locale) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Devise</p>
            <p className="font-semibold text-gray-900">{invoice.currency}</p>
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Qté</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Prix unit.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Remise</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total HT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoice.lines.map(l => (
              <tr key={l.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{l.description}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatNumber(l.quantity)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatNumber(l.unit_price, 2)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{l.discount > 0 ? `${l.discount}%` : "—"}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {formatNumber(lineTotal(l), 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-gray-100 px-4 py-3 flex justify-end">
          <p className="font-bold text-gray-900">
            Total HT : {formatCurrency(invoice.total_ht, invoice.currency as "USD" | "GNF" | "EUR")}
          </p>
        </div>
      </div>

      {/* Historique des paiements */}
      {invoice.payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <h2 className="font-semibold text-gray-800 px-5 py-4 border-b border-gray-50">Paiements reçus</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mode</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Référence</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoice.payments.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-gray-600">{formatDate(p.paid_at, locale)}</td>
                  <td className="px-4 py-3 text-gray-600">{methodLabel[p.method] ?? p.method}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    +{formatCurrency(p.amount, p.currency as "USD" | "GNF" | "EUR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bons de livraison liés */}
      {deliveryNotes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <h2 className="font-semibold text-gray-800 px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <Truck className="w-4 h-4 text-gray-400" /> Bons de livraison
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
                    {dn.status === "delivered" ? "Livré" : dn.status === "cancelled" ? "Annulé" : "En cours"}
                  </span>
                  {dn.delivery_date && (
                    <span className="text-xs text-gray-400">{formatDate(dn.delivery_date, locale)}</span>
                  )}
                </div>
                <Link
                  href={`/${locale}/ventes/bons-livraison/${dn.id}`}
                  className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                >
                  Ouvrir →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {invoice.notes && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Modal confirmation */}
      <Modal open={confirmModalOpen} onClose={() => { setConfirmModalOpen(false); setError(null) }} title="Confirmer la facture">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            La facture passera au statut <strong>Comptabilisé</strong>. Le stock sera sorti lors de la confirmation du bon de livraison.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setConfirmModalOpen(false); setError(null) }}>Annuler</Button>
            <Button onClick={confirmAndSend} disabled={saving}>
              {saving ? "Confirmation…" : "Confirmer la facture"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal paiement — style Odoo */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Payer">
        <div className="space-y-0">
          {/* Grille 2 colonnes */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-2">
            {/* Colonne gauche */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Journal</p>
                {treasuryAccounts.length > 0 ? (
                  <select
                    value={paymentForm.treasury_account_id}
                    onChange={e => setPaymentForm(f => ({ ...f, treasury_account_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                  >
                    <option value="">— Aucun journal —</option>
                    {treasuryAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-400 italic">Aucun compte configuré</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Mode de paiement</p>
                <select
                  value={paymentForm.method}
                  onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                >
                  <option value="bank">Virement bancaire</option>
                  <option value="cash">Espèces</option>
                  <option value="mobile">Mobile money</option>
                  <option value="cheque">Chèque</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Référence</p>
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
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Montant</p>
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
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Date de règlement</p>
                <input
                  type="date"
                  value={paymentForm.paid_at}
                  onChange={e => setPaymentForm(f => ({ ...f, paid_at: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Mémo</p>
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
              Paiement partiel — il restera{" "}
              <strong>{formatCurrency(invoice.balance - (parseFloat(paymentForm.amount) || 0), invoice.currency as "USD" | "GNF" | "EUR")}</strong>{" "}
              dû après ce versement.
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

          <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
            <Button onClick={savePayment} disabled={saving}>
              {saving ? "Enregistrement…" : "Créer un paiement"}
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Ignorer</Button>
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
