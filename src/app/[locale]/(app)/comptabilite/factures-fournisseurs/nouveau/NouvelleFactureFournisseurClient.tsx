"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, ArrowLeft, FileText, ChevronDown, X } from "lucide-react"
import Link from "next/link"

interface TreasuryAccount { id: string; name: string; type: string; currency: string }
interface PrefillLine { description: string; quantity: string; unit_price: string; tax_rate: string }
interface Prefill { order_id: string; reception_id: string | null; supplier: string; supplier_id?: string | null; currency: string; reference: string; lines?: PrefillLine[] }
interface SupplierOption { id: string; name: string; currency: string; payment_terms: string | null }
interface Props { locale: string; treasuryAccounts: TreasuryAccount[]; prefill?: Prefill | null; suppliers: SupplierOption[] }

interface Line {
  id: number
  description: string
  quantity: string
  unit_price: string
  tax_rate: string
}

let _uid = 0
const uid = () => ++_uid
const newLine = (): Line => ({ id: uid(), description: "", quantity: "1", unit_price: "0", tax_rate: "0" })

type Currency = "GNF" | "USD" | "EUR"

const QUICK_FORM_EMPTY = { name: "", currency: "USD", payment_terms: "" }

export default function NouvelleFactureFournisseurClient({ locale, treasuryAccounts, prefill, suppliers: initialSuppliers }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>(initialSuppliers)
  const [form, setForm] = useState({
    supplier_id: prefill?.supplier_id ?? "",
    supplier_name: prefill?.supplier ?? "",
    currency: (prefill?.currency ?? "GNF") as Currency,
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: "",
    reference: prefill?.reference ?? "",
    notes: "",
    treasury_account_id: "",
    pay_immediately: false,
    payment_method: "virement",
  })
  const [lines, setLines] = useState<Line[]>(
    prefill?.lines && prefill.lines.length > 0
      ? prefill.lines.map(l => ({ id: uid(), description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate }))
      : [newLine()]
  )

  // Supplier dropdown
  const [supplierSearch, setSupplierSearch] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [quickForm, setQuickForm] = useState(QUICK_FORM_EMPTY)
  const [quickSaving, setQuickSaving] = useState(false)
  const supplierRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const filteredSuppliers = supplierSearch.length >= 1
    ? suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
    : suppliers.slice(0, 10)

  const selectedSupplier = form.supplier_id ? suppliers.find(s => s.id === form.supplier_id) : null

  function selectSupplier(s: SupplierOption) {
    setForm(f => ({ ...f, supplier_id: s.id, supplier_name: s.name, currency: (s.currency as Currency) ?? f.currency }))
    setSupplierSearch("")
    setShowDropdown(false)
  }

  function clearSupplier() {
    setForm(f => ({ ...f, supplier_id: "", supplier_name: "" }))
    setSupplierSearch("")
  }

  async function handleQuickCreate() {
    if (!quickForm.name.trim()) return
    setQuickSaving(true)
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: quickForm.name.trim(), currency: quickForm.currency, payment_terms: quickForm.payment_terms || null }),
      })
      const json = await res.json()
      if (!res.ok) return
      const newSupplier: SupplierOption = { id: json.id, name: json.name, currency: json.currency ?? "USD", payment_terms: json.payment_terms ?? null }
      setSuppliers(list => [...list, newSupplier].sort((a, b) => a.name.localeCompare(b.name)))
      selectSupplier(newSupplier)
      setShowQuickCreate(false)
      setQuickForm(QUICK_FORM_EMPTY)
    } finally {
      setQuickSaving(false)
    }
  }

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function updateLine(id: number, patch: Partial<Line>) {
    setLines(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  const subtotalHT = lines.reduce((s, l) => {
    const qty = parseFloat(l.quantity) || 0
    const pu  = parseFloat(l.unit_price) || 0
    return s + qty * pu
  }, 0)

  const taxAmount = lines.reduce((s, l) => {
    const qty  = parseFloat(l.quantity) || 0
    const pu   = parseFloat(l.unit_price) || 0
    const rate = parseFloat(l.tax_rate) || 0
    return s + qty * pu * rate / 100
  }, 0)

  const totalTTC = subtotalHT + taxAmount

  async function handleSave() {
    if (!form.supplier_name.trim()) { setError("Le nom du fournisseur est requis"); return }
    if (lines.some(l => !l.description.trim())) { setError("Toutes les lignes doivent avoir une description"); return }

    setSaving(true)
    setError(null)

    const res = await fetch("/api/supplier-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier_name: form.supplier_name.trim(),
        supplier_id: form.supplier_id || null,
        currency: form.currency,
        invoice_date: form.invoice_date,
        due_date: form.due_date || null,
        reference: form.reference || null,
        notes: form.notes || null,
        total_ht: subtotalHT,
        tax_amount: taxAmount,
        total_ttc: totalTTC,
        status: form.pay_immediately ? "paid" : "pending",
        purchase_order_id: prefill?.order_id ?? null,
        reception_id: prefill?.reception_id ?? null,
        lines: lines.map(l => ({
          description: l.description,
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          tax_rate: parseFloat(l.tax_rate) || 0,
        })),
        pay_immediately: form.pay_immediately,
        treasury_account_id: form.treasury_account_id || null,
        payment_method: form.payment_method,
      }),
    })

    const json = await res.json()
    if (!res.ok || !json.id) { setError(json.error ?? "Erreur lors de la création"); setSaving(false); return }

    router.push(`/${locale}/comptabilite/factures-fournisseurs/${json.id}`)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href={`/${locale}/comptabilite/factures-fournisseurs`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Retour aux factures fournisseurs
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nouvelle facture fournisseur</h1>

      {prefill && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 mb-2">
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span>Créée depuis le bon de commande <strong>{prefill.reference}</strong> — fournisseur et devise pré-remplis.</span>
        </div>
      )}

      <div className="space-y-6">

        {/* Fournisseur & infos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Informations fournisseur</h2>
          <div className="grid grid-cols-2 gap-4">

            {/* Supplier selector */}
            <div className="col-span-2 relative" ref={supplierRef}>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Fournisseur *</label>
              {selectedSupplier ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-blue-300 rounded-lg bg-blue-50">
                  <span className="flex-1 text-sm font-medium text-blue-900">{selectedSupplier.name}</span>
                  {selectedSupplier.payment_terms && (
                    <span className="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">{selectedSupplier.payment_terms}</span>
                  )}
                  <button onClick={clearSupplier} className="text-blue-400 hover:text-blue-700 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <input
                      value={supplierSearch}
                      onChange={e => { setSupplierSearch(e.target.value); setShowDropdown(true) }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder={prefill?.supplier ? prefill.supplier : "Rechercher un fournisseur…"}
                      className="w-full px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  {showDropdown && (
                    <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {filteredSuppliers.length > 0
                        ? filteredSuppliers.map(s => (
                          <li key={s.id}
                            onMouseDown={() => selectSupplier(s)}
                            className="px-3 py-2 text-sm text-gray-800 hover:bg-blue-50 cursor-pointer flex items-center justify-between">
                            <span>{s.name}</span>
                            <span className="text-xs text-gray-400">{s.currency}</span>
                          </li>
                        ))
                        : <li className="px-3 py-2 text-xs text-gray-400">Aucun fournisseur trouvé</li>
                      }
                      <li
                        onMouseDown={() => { setShowDropdown(false); setShowQuickCreate(true); setQuickForm(f => ({ ...f, name: supplierSearch })) }}
                        className="px-3 py-2 text-sm text-[#7c3aed] hover:bg-purple-50 cursor-pointer flex items-center gap-1.5 border-t border-gray-100 font-medium">
                        <Plus className="w-3.5 h-3.5" /> Nouveau fournisseur
                      </li>
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Date de facturation</label>
              <input type="date" value={form.invoice_date}
                onChange={e => setF("invoice_date", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Date d&apos;échéance</label>
              <input type="date" value={form.due_date}
                onChange={e => setF("due_date", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Référence fournisseur</label>
              <input value={form.reference}
                onChange={e => setF("reference", e.target.value)}
                placeholder="N° facture fournisseur"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Devise</label>
              <select value={form.currency} onChange={e => setF("currency", e.target.value as Currency)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="GNF">GNF</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lignes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Lignes de facturation</h2>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 px-1">
              <div className="col-span-5">Description</div>
              <div className="col-span-2 text-right">Qté</div>
              <div className="col-span-2 text-right">Prix unitaire</div>
              <div className="col-span-2 text-right">TVA %</div>
              <div className="col-span-1" />
            </div>
            {lines.map(l => (
              <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <input value={l.description} onChange={e => updateLine(l.id, { description: e.target.value })}
                    placeholder="Description de l'achat"
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <input type="number" min="0" step="any" value={l.quantity}
                    onChange={e => updateLine(l.id, { quantity: e.target.value })}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
                </div>
                <div className="col-span-2">
                  <input type="number" min="0" step="any" value={l.unit_price}
                    onChange={e => updateLine(l.id, { unit_price: e.target.value })}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
                </div>
                <div className="col-span-2">
                  <input type="number" min="0" max="100" step="any" value={l.tax_rate}
                    onChange={e => updateLine(l.id, { tax_rate: e.target.value })}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
                </div>
                <div className="col-span-1 flex justify-end">
                  {lines.length > 1 && (
                    <button onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))}
                      className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setLines(ls => [...ls, newLine()])}
            className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-500 font-medium">
            <Plus className="w-4 h-4" /> Ajouter une ligne
          </button>

          {/* Totaux */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
            <div className="space-y-1.5 min-w-[260px]">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Sous-total HT</span>
                <span className="font-medium text-gray-800">{subtotalHT.toLocaleString("fr")} {form.currency}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>TVA</span>
                  <span className="font-medium text-gray-800">{taxAmount.toLocaleString("fr")} {form.currency}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-900">Total TTC</span>
                <span className="text-xl font-bold text-blue-600">{totalTTC.toLocaleString("fr")} {form.currency}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Paiement immédiat */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.pay_immediately}
              onChange={e => setF("pay_immediately", e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="font-medium text-gray-800">Marquer comme payée immédiatement</span>
          </label>
          {form.pay_immediately && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Compte de trésorerie débité</label>
                <select value={form.treasury_account_id}
                  onChange={e => setF("treasury_account_id", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Sélectionner un compte —</option>
                  {treasuryAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Mode de paiement</label>
                <select value={form.payment_method}
                  onChange={e => setF("payment_method", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="virement">Virement bancaire</option>
                  <option value="especes">Espèces</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="cheque">Chèque</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-3">Notes internes</h2>
          <textarea rows={3} value={form.notes}
            onChange={e => setF("notes", e.target.value)}
            placeholder="Remarques, numéro de commande, détails…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

        <div className="flex justify-end gap-3 pb-8">
          <button onClick={() => router.back()}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? "Création…" : "Créer la facture"}
          </button>
        </div>
      </div>

      {/* Quick-create supplier modal */}
      {showQuickCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Nouveau fournisseur</h3>
              <button onClick={() => setShowQuickCreate(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom *</label>
                <input value={quickForm.name} onChange={e => setQuickForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Devise</label>
                <select value={quickForm.currency} onChange={e => setQuickForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="USD">USD</option>
                  <option value="GNF">GNF</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Conditions de paiement</label>
                <select value={quickForm.payment_terms} onChange={e => setQuickForm(f => ({ ...f, payment_terms: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Non défini —</option>
                  <option value="immediate">Immédiat</option>
                  <option value="30j">30 jours</option>
                  <option value="60j">60 jours</option>
                  <option value="90j">90 jours</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowQuickCreate(false)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleQuickCreate} disabled={quickSaving || !quickForm.name.trim()}
                className="px-3 py-2 text-sm bg-[#7c3aed] text-white font-medium rounded-lg hover:bg-[#6d28d9] disabled:opacity-50 transition">
                {quickSaving ? "Création…" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
