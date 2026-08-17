"use client"

import { useEffect, useState } from "react"
import {
  TrendingUp, TrendingDown, Package, Truck, Award, MoreHorizontal,
  Plus, Trash2, Check, X, ChevronDown, ChevronUp, Loader2
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type InvoiceData = {
  id: string
  number: string
  status: string
  total_ht: number
  total_ttc: number
  total_paid: number
  currency: string
}

type SupplierInvoice = {
  id: string
  number: string
  supplier_name: string | null
  total_ttc: number
  total_ht: number
  currency: string
  status: string
  invoice_date: string
}

type DealCost = {
  id: string
  type: "commission" | "transport" | "achat" | "autre"
  label: string | null
  amount: number
  currency: string
  paid: boolean
  created_at: string
}

const COST_TYPE_LABELS: Record<string, string> = {
  commission: "Commission",
  transport: "Transport",
  achat: "Achat",
  autre: "Divers",
}

const COST_TYPE_ICON: Record<string, React.ReactNode> = {
  commission: <Award className="w-3.5 h-3.5" />,
  transport: <Truck className="w-3.5 h-3.5" />,
  achat: <Package className="w-3.5 h-3.5" />,
  autre: <MoreHorizontal className="w-3.5 h-3.5" />,
}

const COST_TYPE_COLOR: Record<string, string> = {
  commission: "bg-purple-50 text-purple-600",
  transport: "bg-blue-50 text-blue-600",
  achat: "bg-orange-50 text-orange-600",
  autre: "bg-gray-100 text-gray-500",
}

interface Props {
  dealId: string
  dealCurrency: string
  invoiceFromProps: InvoiceData | null
}

export default function DealFinancialsPanel({ dealId, dealCurrency, invoiceFromProps }: Props) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(invoiceFromProps)
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([])
  const [dealCosts, setDealCosts] = useState<DealCost[]>([])
  const [loading, setLoading] = useState(true)

  // Add cost form
  const [addCostOpen, setAddCostOpen] = useState(false)
  const [costForm, setCostForm] = useState({ type: "commission", label: "", amount: "", currency: dealCurrency, paid: false })
  const [costSaving, setCostSaving] = useState(false)

  // Supplier invoice picker
  const [suppPickerOpen, setSuppPickerOpen] = useState(false)
  const [suppSearch, setSuppSearch] = useState("")
  const [suppResults, setSuppResults] = useState<SupplierInvoice[]>([])
  const [suppLinking, setSuppLinking] = useState(false)

  // Collapsed state for costs section
  const [costsExpanded, setCostsExpanded] = useState(true)

  useEffect(() => {
    fetch(`/api/deals/${dealId}/financials`)
      .then(r => r.json())
      .then(data => {
        setSupplierInvoices(data.supplierInvoices ?? [])
        setDealCosts(data.dealCosts ?? [])
        if (data.invoice) setInvoice(data.invoice)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [dealId])

  async function searchSupplierInvoices(q: string) {
    setSuppSearch(q)
    if (q.length < 2) { setSuppResults([]); return }
    const res = await fetch(`/api/supplier-invoices/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setSuppResults(Array.isArray(data) ? data : [])
  }

  async function linkSupplierInvoice(inv: SupplierInvoice) {
    setSuppLinking(true)
    const res = await fetch(`/api/deals/${dealId}/supplier-invoice`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier_invoice_id: inv.id, action: "link" }),
    })
    if (res.ok) {
      setSupplierInvoices(prev => [inv, ...prev])
      setSuppPickerOpen(false)
      setSuppSearch("")
      setSuppResults([])
    }
    setSuppLinking(false)
  }

  async function unlinkSupplierInvoice(id: string) {
    if (!confirm("Dissocier cette facture fournisseur du deal ?")) return
    const res = await fetch(`/api/deals/${dealId}/supplier-invoice`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier_invoice_id: id, action: "unlink" }),
    })
    if (res.ok) setSupplierInvoices(prev => prev.filter(i => i.id !== id))
  }

  async function addCost() {
    if (!costForm.amount || Number(costForm.amount) <= 0) return
    setCostSaving(true)
    const res = await fetch(`/api/deals/${dealId}/financials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: costForm.type,
        label: costForm.label || null,
        amount: Number(costForm.amount),
        currency: costForm.currency,
        paid: costForm.paid,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setDealCosts(prev => [data, ...prev])
      setCostForm({ type: "commission", label: "", amount: "", currency: dealCurrency, paid: false })
      setAddCostOpen(false)
    }
    setCostSaving(false)
  }

  async function deleteCost(id: string) {
    const res = await fetch(`/api/deals/${dealId}/costs/${id}`, { method: "DELETE" })
    if (res.ok) setDealCosts(prev => prev.filter(c => c.id !== id))
  }

  async function toggleCostPaid(cost: DealCost) {
    const res = await fetch(`/api/deals/${dealId}/costs/${cost.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: !cost.paid }),
    })
    if (res.ok) setDealCosts(prev => prev.map(c => c.id === cost.id ? { ...c, paid: !c.paid } : c))
  }

  // ── Margin computation (in deal currency) ──
  // We show figures if all items share the same currency; otherwise still show the breakdown
  const revenueTTC = invoice?.total_ttc ?? 0
  const revenuePaid = invoice?.total_paid ?? 0
  const invoiceCurrency = invoice?.currency ?? dealCurrency

  const totalSupplierCost = supplierInvoices.reduce((s, i) => {
    if (i.currency === invoiceCurrency) return s + Number(i.total_ttc)
    return s // mixed currency — skip from totals
  }, 0)
  const totalManualCost = dealCosts.reduce((s, c) => {
    if (c.currency === invoiceCurrency) return s + Number(c.amount)
    return s
  }, 0)
  const totalManualCostPaid = dealCosts.filter(c => c.paid).reduce((s, c) => {
    if (c.currency === invoiceCurrency) return s + Number(c.amount)
    return s
  }, 0)
  const totalSupplierCostPaid = supplierInvoices.filter(i => i.status === "paid").reduce((s, i) => {
    if (i.currency === invoiceCurrency) return s + Number(i.total_ttc)
    return s
  }, 0)

  const totalCosts = totalSupplierCost + totalManualCost
  const totalCostsPaid = totalSupplierCostPaid + totalManualCostPaid
  const marginEstimated = revenueTTC - totalCosts
  const marginConfirmed = revenuePaid - totalCostsPaid
  const marginPct = revenueTTC > 0 ? (marginEstimated / revenueTTC) * 100 : null
  const marginPaidPct = revenuePaid > 0 ? (marginConfirmed / revenuePaid) * 100 : null
  const hasCosts = supplierInvoices.length > 0 || dealCosts.length > 0

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Revenue card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <h3 className="text-sm font-semibold text-gray-900">Revenus</h3>
        </div>
        {invoice ? (
          <div className="px-4 py-3 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <a href={`/fr/ventes/factures/${invoice.id}`} className="font-mono text-blue-600 hover:underline text-xs font-medium">{invoice.number}</a>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                invoice.status === "paid" ? "bg-green-50 text-green-600" :
                invoice.status === "sent" ? "bg-blue-50 text-blue-600" :
                "bg-gray-100 text-gray-500"
              }`}>
                {invoice.status === "paid" ? "Payée" : invoice.status === "sent" ? "Envoyée" : "Brouillon"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">Montant HT</p>
                <p className="text-sm font-semibold text-gray-800">{formatCurrency(invoice.total_ht, invoiceCurrency)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">Montant TTC</p>
                <p className="text-sm font-semibold text-gray-800">{formatCurrency(invoice.total_ttc, invoiceCurrency)}</p>
              </div>
              <div className={`rounded-lg px-3 py-2.5 ${invoice.total_paid >= invoice.total_ttc && invoice.total_ttc > 0 ? "bg-green-50" : "bg-amber-50"}`}>
                <p className="text-xs text-gray-400 mb-0.5">Encaissé</p>
                <p className="text-sm font-semibold text-green-700">{formatCurrency(invoice.total_paid, invoiceCurrency)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">Solde</p>
                <p className={`text-sm font-semibold ${invoice.total_ttc - invoice.total_paid > 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatCurrency(invoice.total_ttc - invoice.total_paid, invoiceCurrency)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-5 text-center text-xs text-gray-400">
            Aucune facture client liée — liez une facture dans l&apos;onglet Résumé
          </div>
        )}
      </div>

      {/* Costs card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
          <button className="flex items-center gap-2 text-sm font-semibold text-gray-900" onClick={() => setCostsExpanded(e => !e)}>
            <TrendingDown className="w-4 h-4 text-red-400" />
            Coûts
            {hasCosts && <span className="text-xs font-medium text-gray-400">{supplierInvoices.length + dealCosts.length}</span>}
            {costsExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />}
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSuppPickerOpen(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 transition"
            >
              <Plus className="w-3 h-3" /> Facture fournisseur
            </button>
            <button
              onClick={() => setAddCostOpen(o => !o)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 px-2 py-1 rounded-lg hover:bg-orange-50 transition"
            >
              <Plus className="w-3 h-3" /> Coût manuel
            </button>
          </div>
        </div>

        {costsExpanded && (
          <>
            {/* Add cost form */}
            {addCostOpen && (
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 bg-white"
                    value={costForm.type}
                    onChange={e => setCostForm(f => ({ ...f, type: e.target.value }))}
                  >
                    <option value="commission">Commission</option>
                    <option value="transport">Transport</option>
                    <option value="achat">Achat</option>
                    <option value="autre">Divers</option>
                  </select>
                  <input
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
                    placeholder="Description (optionnel)"
                    value={costForm.label}
                    onChange={e => setCostForm(f => ({ ...f, label: e.target.value }))}
                  />
                  <input
                    type="number"
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
                    placeholder="Montant"
                    value={costForm.amount}
                    onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))}
                  />
                  <select
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 bg-white"
                    value={costForm.currency}
                    onChange={e => setCostForm(f => ({ ...f, currency: e.target.value }))}
                  >
                    <option value="GNF">GNF</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="XOF">XOF</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={costForm.paid} onChange={e => setCostForm(f => ({ ...f, paid: e.target.checked }))} />
                    Déjà payé
                  </label>
                  <div className="flex gap-1.5">
                    <button onClick={() => setAddCostOpen(false)} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={addCost}
                      disabled={costSaving || !costForm.amount}
                      className="px-3 py-1 text-xs font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-40"
                    >
                      {costSaving ? "..." : "Ajouter"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Supplier invoices */}
            {supplierInvoices.length > 0 && (
              <div className="divide-y divide-gray-50">
                {supplierInvoices.map(inv => (
                  <div key={inv.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-orange-50 text-orange-600`}>
                      <Package className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <a href={`/fr/comptabilite/factures-fournisseurs/${inv.id}`} className="text-xs font-mono text-blue-600 hover:underline">{inv.number}</a>
                      <p className="text-xs text-gray-400 truncate">{inv.supplier_name ?? "Fournisseur"}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-gray-700">{formatCurrency(Number(inv.total_ttc), inv.currency)}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        inv.status === "paid" ? "bg-green-50 text-green-600" :
                        inv.status === "partial" ? "bg-amber-50 text-amber-600" :
                        "bg-gray-100 text-gray-400"
                      }`}>
                        {inv.status === "paid" ? "Payée" : inv.status === "partial" ? "Partiel" : "En attente"}
                      </span>
                    </div>
                    <button
                      onClick={() => unlinkSupplierInvoice(inv.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-500 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Manual costs */}
            {dealCosts.length > 0 && (
              <div className="divide-y divide-gray-50">
                {dealCosts.map(cost => (
                  <div key={cost.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${COST_TYPE_COLOR[cost.type]}`}>
                      {COST_TYPE_ICON[cost.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700">{cost.label ?? COST_TYPE_LABELS[cost.type]}</p>
                      <p className="text-xs text-gray-400">{COST_TYPE_LABELS[cost.type]}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-xs font-semibold text-gray-700">{formatCurrency(Number(cost.amount), cost.currency)}</p>
                      <button
                        onClick={() => toggleCostPaid(cost)}
                        title={cost.paid ? "Marquer non payé" : "Marquer payé"}
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition ${
                          cost.paid ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-300 hover:bg-green-50 hover:text-green-400"
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteCost(cost.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-500 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!hasCosts && !addCostOpen && (
              <div className="px-4 py-5 text-center text-xs text-gray-400">Aucun coût enregistré</div>
            )}
          </>
        )}
      </div>

      {/* Margin summary */}
      {(invoice || hasCosts) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Marge opérationnelle</h3>
          </div>
          <div className="p-4 space-y-3">
            {/* Estimated */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Estimée (TTC)</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Revenus TTC</span>
                <span className="font-medium text-gray-700">{formatCurrency(revenueTTC, invoiceCurrency)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Total coûts</span>
                <span className="font-medium text-red-500">− {formatCurrency(totalCosts, invoiceCurrency)}</span>
              </div>
              <div className={`flex items-center justify-between rounded-lg px-3 py-2 mt-1 ${marginEstimated >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                <span className={`text-sm font-semibold ${marginEstimated >= 0 ? "text-green-700" : "text-red-600"}`}>Marge estimée</span>
                <div className="text-right">
                  <p className={`text-sm font-bold ${marginEstimated >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {formatCurrency(marginEstimated, invoiceCurrency)}
                  </p>
                  {marginPct !== null && (
                    <p className={`text-xs font-medium ${marginEstimated >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {marginPct.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Confirmed (paid) */}
            {invoice?.status === "paid" || revenuePaid > 0 ? (
              <div className="space-y-1.5 border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Confirmée (encaissée)</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Encaissé</span>
                  <span className="font-medium text-gray-700">{formatCurrency(revenuePaid, invoiceCurrency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Coûts payés</span>
                  <span className="font-medium text-red-500">− {formatCurrency(totalCostsPaid, invoiceCurrency)}</span>
                </div>
                <div className={`flex items-center justify-between rounded-lg px-3 py-2 mt-1 ${marginConfirmed >= 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  <span className={`text-sm font-semibold ${marginConfirmed >= 0 ? "text-green-700" : "text-red-600"}`}>Marge confirmée ✓</span>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${marginConfirmed >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {formatCurrency(marginConfirmed, invoiceCurrency)}
                    </p>
                    {marginPaidPct !== null && (
                      <p className={`text-xs font-medium ${marginConfirmed >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {marginPaidPct.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Supplier invoice picker modal */}
      {suppPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setSuppPickerOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">Lier une facture fournisseur</h2>
              <button onClick={() => setSuppPickerOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-3">
              <input
                autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Rechercher par numéro ou fournisseur…"
                value={suppSearch}
                onChange={e => searchSupplierInvoices(e.target.value)}
              />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 pb-2">
              {suppResults.length === 0 && suppSearch.length < 2 && (
                <p className="text-xs text-gray-400 text-center py-6">Tapez pour chercher une facture fournisseur</p>
              )}
              {suppResults.length === 0 && suppSearch.length >= 2 && (
                <p className="text-xs text-gray-400 text-center py-6">Aucun résultat (sans deal associé)</p>
              )}
              {suppResults.map(inv => (
                <button
                  key={inv.id}
                  onClick={() => linkSupplierInvoice(inv)}
                  disabled={suppLinking}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition text-left disabled:opacity-40"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 font-mono">{inv.number}</p>
                    <p className="text-xs text-gray-400">{inv.supplier_name ?? "Fournisseur"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-gray-700">{formatCurrency(Number(inv.total_ttc), inv.currency)}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      inv.status === "paid" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                    }`}>
                      {inv.status === "paid" ? "Payée" : "En attente"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
