"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, X, ChevronDown, Ban, Trash2, Printer } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { useRouter } from "next/navigation"

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  paid: "Payée",
  partial: "Partielle",
  cancelled: "Annulée",
}
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  partial: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-600",
}
const METHOD_LABEL: Record<string, string> = {
  cash: "Espèces",
  bank: "Virement",
  mobile: "Mobile Money",
  cheque: "Chèque",
  other: "Autre",
}

type Line = { id: string; description: string; quantity: number; unit_price: number; tax_rate: number }
type Payment = { id: string; amount: number; currency: string; method: string; reference: string | null; notes: string | null; paid_at: string }
type TreasuryAccount = { id: string; name: string; type: string; currency: string }
type Invoice = {
  id: string; number: string; supplier_name: string; status: string
  invoice_date: string; due_date: string | null; reference: string | null; currency: string
  total_ht: number; tax_amount: number; total_ttc: number; total_paid: number; balance: number
  notes: string | null
}

export default function FactureFournisseurDetailClient({
  invoice: initialInvoice,
  lines,
  payments: initialPayments,
  treasuryAccounts,
  locale,
}: {
  invoice: Invoice
  lines: Line[]
  payments: Payment[]
  treasuryAccounts: TreasuryAccount[]
  locale: string
}) {
  const router = useRouter()
  const [invoice, setInvoice] = useState(initialInvoice)
  const [payments, setPayments] = useState(initialPayments)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    amount: String(Math.max(initialInvoice.balance, 0)),
    currency: initialInvoice.currency,
    method: "bank",
    treasury_account_id: treasuryAccounts[0]?.id ?? "",
    reference: "",
    notes: "",
    paid_at: new Date().toISOString().split("T")[0],
  })

  function setF(k: string, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function deletePayment(paymentId: string, amount: number, currency: string) {
    if (!window.confirm(`Annuler ce paiement de ${Number(amount).toLocaleString("fr")} ${currency} ?`)) return
    const res = await fetch(`/api/supplier-invoices/${invoice.id}/payments/${paymentId}`, { method: "DELETE" })
    const json = await res.json()
    if (!res.ok) { alert(json.error ?? "Erreur"); return }
    setPayments(prev => prev.filter(p => p.id !== paymentId))
    setInvoice(prev => ({
      ...prev,
      total_paid: json.totalPaid,
      balance: json.balance,
      status: json.newStatus,
    }))
  }

  async function submitPayment() {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) { setError("Montant invalide"); return }
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/supplier-invoices/${invoice.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error ?? "Erreur serveur"); return }

    setInvoice(prev => ({
      ...prev,
      status: json.newStatus,
      total_paid: prev.total_paid + amount,
      balance: json.balance,
    }))
    setPayments(prev => [json.payment, ...prev])
    setModalOpen(false)
    router.refresh()
  }

  const isPaid = invoice.status === "paid" || invoice.status === "cancelled"
  const isCancelled = invoice.status === "cancelled"
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function cancelInvoice() {
    if (!window.confirm("Annuler cette facture fournisseur ?")) return
    const res = await fetch(`/api/supplier-invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    })
    if (res.ok) {
      setInvoice(prev => ({ ...prev, status: "cancelled" }))
      setMenuOpen(false)
    }
  }

  async function deleteInvoice() {
    if (!window.confirm("Supprimer définitivement cette facture ? Cette action est irréversible.")) return
    const res = await fetch(`/api/supplier-invoices/${invoice.id}`, { method: "DELETE" })
    const json = await res.json()
    if (!res.ok) { alert(json.error ?? "Erreur"); return }
    router.push(`/${locale}/comptabilite/factures-fournisseurs`)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link
        href={`/${locale}/comptabilite/factures-fournisseurs`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{invoice.number}</h1>
          <p className="text-gray-500 mt-0.5">{invoice.supplier_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLOR[invoice.status] ?? STATUS_COLOR.pending}`}>
            {STATUS_LABEL[invoice.status] ?? invoice.status}
          </span>
          {!isPaid && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Enregistrer un paiement
            </button>
          )}
          {/* Menu actions */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Actions <ChevronDown className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                <button
                  onClick={() => { window.print(); setMenuOpen(false) }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Printer className="w-4 h-4 text-gray-400" /> Imprimer
                </button>
                {!isCancelled && (
                  <button
                    onClick={cancelInvoice}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50"
                  >
                    <Ban className="w-4 h-4" /> Annuler la facture
                  </button>
                )}
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={deleteInvoice}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" /> Supprimer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm">Informations</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{formatDate(invoice.invoice_date)}</span></div>
            {invoice.due_date && <div className="flex justify-between"><span className="text-gray-500">Échéance</span><span>{formatDate(invoice.due_date)}</span></div>}
            {invoice.reference && <div className="flex justify-between"><span className="text-gray-500">Référence</span><span>{invoice.reference}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500">Devise</span><span>{invoice.currency}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm">Montants</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total HT</span><span className="font-medium">{Number(invoice.total_ht).toLocaleString("fr")} {invoice.currency}</span></div>
            {Number(invoice.tax_amount) > 0 && <div className="flex justify-between"><span className="text-gray-500">TVA</span><span className="font-medium">{Number(invoice.tax_amount).toLocaleString("fr")} {invoice.currency}</span></div>}
            <div className="flex justify-between pt-2 border-t border-gray-100"><span className="font-semibold text-gray-900">Total TTC</span><span className="font-bold text-blue-600 text-base">{Number(invoice.total_ttc).toLocaleString("fr")} {invoice.currency}</span></div>
            {invoice.total_paid > 0 && (
              <>
                <div className="flex justify-between text-emerald-700"><span>Payé</span><span className="font-medium">−{Number(invoice.total_paid).toLocaleString("fr")} {invoice.currency}</span></div>
                <div className="flex justify-between pt-2 border-t border-gray-100 font-semibold">
                  <span className={invoice.balance <= 0 ? "text-emerald-700" : "text-amber-700"}>Solde restant</span>
                  <span className={invoice.balance <= 0 ? "text-emerald-700" : "text-amber-700"}>{Math.max(0, invoice.balance).toLocaleString("fr")} {invoice.currency}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Description</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Qté</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Prix unit.</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">TVA %</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lines.map(l => {
              const total = Number(l.quantity) * Number(l.unit_price) * (1 + Number(l.tax_rate) / 100)
              return (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-gray-800">{l.description}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{Number(l.quantity).toLocaleString("fr")}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{Number(l.unit_price).toLocaleString("fr")}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{Number(l.tax_rate)}%</td>
                  <td className="px-4 py-3 text-right font-medium">{total.toLocaleString("fr")}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm">Paiements enregistrés</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Mode</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Référence</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">Montant</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-gray-600">{formatDate(p.paid_at)}</td>
                  <td className="px-4 py-3 text-gray-600">{METHOD_LABEL[p.method] ?? p.method}</td>
                  <td className="px-4 py-3 text-gray-500">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-700">{Number(p.amount).toLocaleString("fr")} {p.currency}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deletePayment(p.id, p.amount, p.currency)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                      title="Annuler ce paiement"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invoice.notes && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 text-sm mb-2">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Modal paiement */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Enregistrer un paiement</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setF("amount", e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={form.currency}
                    onChange={e => setF("currency", e.target.value)}
                    className="w-24 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {["GNF", "USD", "EUR"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {invoice.balance > 0 && (
                  <p className="text-xs text-gray-400 mt-1">Solde restant : {Number(invoice.balance).toLocaleString("fr")} {invoice.currency}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={form.paid_at}
                  onChange={e => setF("paid_at", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
                <select
                  value={form.method}
                  onChange={e => setF("method", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bank">Virement</option>
                  <option value="cash">Espèces</option>
                  <option value="mobile">Mobile Money</option>
                  <option value="cheque">Chèque</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              {treasuryAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Compte trésorerie</label>
                  <select
                    value={form.treasury_account_id}
                    onChange={e => setF("treasury_account_id", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Aucun —</option>
                    {treasuryAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Référence</label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={e => setF("reference", e.target.value)}
                  placeholder="N° de virement, chèque..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setF("notes", e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Annuler
              </button>
              <button
                onClick={submitPayment}
                disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
