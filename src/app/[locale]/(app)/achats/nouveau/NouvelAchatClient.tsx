"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, ArrowLeft, Info, RefreshCw, ChevronDown, X } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"

interface Product { id: string; name: string; reference: string | null; buy_price: number | null }
interface Supplier { id: string; name: string; currency: string; payment_terms: string | null }
interface Props { products: Product[]; suppliers: Supplier[]; locale: string }

const STORAGE_KEY = "nouvel_achat_draft"

interface Line {
  id: number
  product_id: string
  description: string
  quantity: string
  unit_price: string
}

let _lid = 0
const nextId = () => ++_lid

const DEFAULT_FORM = {
  supplier_id: "",
  supplier_name: "",
  currency: "GNF" as "USD" | "GNF" | "EUR",
  incoterm: "CIF",
  order_date: new Date().toISOString().split("T")[0],
  expected_date: "",
  notes: "",
  freight_cost: "",
  insurance_cost: "",
  global_discount_pct: "",
}

const DEFAULT_LINES: Line[] = [
  { id: nextId(), product_id: "", description: "", quantity: "1", unit_price: "0" },
]

const QUICK_FORM_EMPTY = { name: "", currency: "USD", payment_terms: "" }

export default function NouvelAchatClient({ products: initialProducts, suppliers: initialSuppliers, locale }: Props) {
  const t = useTranslations("achats")
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [refreshing, setRefreshing] = useState(false)

  // Restore draft from sessionStorage — must be declared before any derived state that uses form
  const [form, setForm] = useState<typeof DEFAULT_FORM>(() => {
    if (typeof window === "undefined") return DEFAULT_FORM
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved).form ?? DEFAULT_FORM
    } catch { /* ignore */ }
    return DEFAULT_FORM
  })
  const [lines, setLines] = useState<Line[]>(() => {
    if (typeof window === "undefined") return DEFAULT_LINES
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved).lines ?? DEFAULT_LINES
    } catch { /* ignore */ }
    return DEFAULT_LINES
  })

  // Supplier dropdown state
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

  function selectSupplier(s: Supplier) {
    setForm(f => ({
      ...f,
      supplier_id: s.id,
      supplier_name: s.name,
      currency: (s.currency as "USD" | "GNF" | "EUR") ?? f.currency,
    }))
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
      const newSupplier: Supplier = { id: json.id, name: json.name, currency: json.currency ?? "USD", payment_terms: json.payment_terms ?? null }
      setSuppliers(list => [...list, newSupplier].sort((a, b) => a.name.localeCompare(b.name)))
      selectSupplier(newSupplier)
      setShowQuickCreate(false)
      setQuickForm(QUICK_FORM_EMPTY)
    } finally {
      setQuickSaving(false)
    }
  }

  // Persist draft to sessionStorage on every change
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ form, lines })) } catch { /* ignore */ }
  }, [form, lines])

  const refreshProducts = useCallback(async () => {
    setRefreshing(true)
    try {
      const { supabase } = getCompanyClientBrowser()
      const { data } = await supabase
        .from("products").select("id, name, reference, buy_price").eq("is_active", true).order("name")
      if (data) setProducts(data)
    } finally { setRefreshing(false) }
  }, [])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refreshProducts() }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [refreshProducts])

  const INCOTERMS = [
    { value: "EXW", label: t("incotermEXW") },
    { value: "FOB", label: t("incotermFOB") },
    { value: "CFR", label: t("incotermCFR") },
    { value: "CIF", label: t("incotermCIF") },
    { value: "DDP", label: t("incotermDDP") },
  ]

  const INCOTERM_INFO: Record<string, string> = {
    EXW: t("incotermInfoEXW"),
    FOB: t("incotermInfoFOB"),
    CFR: t("incotermInfoCFR"),
    CIF: t("incotermInfoCIF"),
    DDP: t("incotermInfoDDP"),
  }

  function setLine(id: number, k: keyof Line, v: string) {
    setLines(ls => ls.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, [k]: v }
      if (k === "product_id") {
        const p = products.find(p => p.id === v)
        if (p) {
          updated.description = p.name
          updated.unit_price = String(p.buy_price ?? 0)
        }
      }
      return updated
    }))
  }

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0)
  const freight = parseFloat(form.freight_cost) || 0
  const insurance = parseFloat(form.insurance_cost) || 0
  const discountPct = parseFloat(form.global_discount_pct) || 0
  const discountAmt = subtotal * discountPct / 100
  const totalCIF = subtotal + freight + insurance - discountAmt

  const showFreight = ["CFR", "CIF", "DDP"].includes(form.incoterm)
  const showInsurance = ["CIF", "DDP"].includes(form.incoterm)

  async function handleSave() {
    if (!form.supplier_name) { setError(t("errorSupplierRequired")); return }
    if (lines.some(l => !l.description)) { setError(t("errorLineDescription")); return }

    setSaving(true)
    setError(null)
    const { supabase } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError(t("errorNotAuthenticated")); setSaving(false); return }

    const costsToCreate: { type: string; label: string; amount: number; currency: string }[] = []
    if (freight > 0) costsToCreate.push({ type: "transport_maritime", label: t("labelSeaFreight"), amount: freight, currency: form.currency })
    if (insurance > 0) costsToCreate.push({ type: "assurance", label: t("labelSeaInsurance"), amount: insurance, currency: form.currency })

    const res = await fetch("/api/achats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: {
          supplier_name: form.supplier_name,
          supplier_id: form.supplier_id || null,
          currency: form.currency,
          incoterm: form.incoterm,
          order_date: form.order_date,
          expected_date: form.expected_date || null,
          notes: form.notes || null,
          freight_cost: freight,
          insurance_cost: insurance,
          global_discount_pct: discountPct,
        },
        lines: lines.map((l, i) => ({
          product_id: l.product_id || null,
          description: l.description,
          quantity: parseFloat(l.quantity) || 1,
          fob_unit_price: parseFloat(l.unit_price) || 0,
          position: i,
        })),
        costs: costsToCreate,
        user_id: user.id,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? t("errorGeneric")); setSaving(false); return }

    try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    router.push(`/${locale}/achats/${json.id}`)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/${locale}/achats`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("backToOrders")}
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("newOrderTitle")}</h1>
      </div>

      <div className="space-y-6">

        {/* Fournisseur & conditions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">{t("sectionSupplier")}</h2>
          <div className="grid grid-cols-2 gap-4">

            {/* Supplier selector */}
            <div className="relative" ref={supplierRef}>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("labelSupplierName")}</label>
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
                      placeholder="Rechercher un fournisseur…"
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

            <Select label={t("labelCurrency")} value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value as "USD" | "GNF" | "EUR" }))}
              options={[{ value: "GNF", label: t("currencyGNF") }, { value: "USD", label: t("currencyUSD") }, { value: "EUR", label: t("currencyEUR") }]} />
            <Input label={t("labelOrderDate")} type="date" value={form.order_date}
              onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} />
            <Input label={t("labelExpectedDate")} type="date" value={form.expected_date}
              onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />

            {/* Incoterm */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("labelIncoterm")}</label>
              <div className="grid grid-cols-5 gap-2">
                {INCOTERMS.map(inc => (
                  <button key={inc.value} type="button"
                    onClick={() => setForm(f => ({ ...f, incoterm: inc.value }))}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold border-2 transition ${
                      form.incoterm === inc.value
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-200 text-gray-600 hover:border-blue-300"
                    }`}>
                    {inc.value}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-500">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-400" />
                {INCOTERM_INFO[form.incoterm]}
              </div>
            </div>
          </div>
        </div>

        {/* Lignes produits */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">{t("sectionProducts")}</h2>
            <button onClick={refreshProducts} disabled={refreshing}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition disabled:opacity-40">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Rafraîchir les produits
            </button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 px-1">
              <div className="col-span-4">{t("colProduct")}</div>
              <div className="col-span-4">{t("colDescription")}</div>
              <div className="col-span-2 text-right">{t("colQuantity")}</div>
              <div className="col-span-2 text-right">{t("colUnitPrice")} ({form.incoterm})</div>
            </div>
            {lines.map(l => (
              <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <select value={l.product_id} onChange={e => setLine(l.id, "product_id", e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">{t("optionFree")}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.reference ? `${p.name} (${p.reference})` : p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4">
                  <input value={l.description} onChange={e => setLine(l.id, "description", e.target.value)}
                    placeholder={t("placeholderDescription")}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <input type="number" min="0" step="any" value={l.quantity}
                    onChange={e => setLine(l.id, "quantity", e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
                </div>
                <div className="col-span-1">
                  <input type="number" min="0" step="any" value={l.unit_price}
                    onChange={e => setLine(l.id, "unit_price", e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => {
                      if (lines.length === 1) {
                        setLines([{ id: nextId(), product_id: "", description: "", quantity: "1", unit_price: "0" }])
                      } else {
                        setLines(ls => ls.filter(x => x.id !== l.id))
                      }
                    }}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setLines(ls => [...ls, { id: nextId(), product_id: "", description: "", quantity: "1", unit_price: "0" }])}
            className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-500 font-medium">
            <Plus className="w-4 h-4" /> {t("addProduct")}
          </button>
        </div>

        {/* Frais & remise */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">{t("sectionFeesDiscount")}</h2>
          <div className="grid grid-cols-3 gap-4">
            {showFreight && (
              <Input
                label={`${t("labelFreight")} (${form.currency})`}
                type="number" min="0" step="any"
                value={form.freight_cost}
                onChange={e => setForm(f => ({ ...f, freight_cost: e.target.value }))}
                placeholder="0"
              />
            )}
            {showInsurance && (
              <Input
                label={`${t("labelInsurance")} (${form.currency})`}
                type="number" min="0" step="any"
                value={form.insurance_cost}
                onChange={e => setForm(f => ({ ...f, insurance_cost: e.target.value }))}
                placeholder="0"
              />
            )}
            <Input
              label={t("labelSupplierDiscount")}
              type="number" min="0" max="100" step="0.01"
              value={form.global_discount_pct}
              onChange={e => setForm(f => ({ ...f, global_discount_pct: e.target.value }))}
              placeholder="0"
            />
          </div>

          {/* Récapitulatif */}
          <div className="mt-6 pt-5 border-t border-gray-100 flex justify-end">
            <div className="space-y-1.5 min-w-[280px]">
              <div className="flex justify-between text-sm text-gray-500">
                <span>{t("subtotalGoods")}</span>
                <span className="font-medium text-gray-800">{subtotal.toLocaleString("fr")} {form.currency}</span>
              </div>
              {showFreight && freight > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>+ {t("summaryFreight")}</span>
                  <span className="font-medium text-gray-800">{freight.toLocaleString("fr")} {form.currency}</span>
                </div>
              )}
              {showInsurance && insurance > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>+ {t("summaryInsurance")}</span>
                  <span className="font-medium text-gray-800">{insurance.toLocaleString("fr")} {form.currency}</span>
                </div>
              )}
              {discountPct > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>− {t("summaryDiscount")} ({discountPct}%)</span>
                  <span className="font-medium">−{discountAmt.toLocaleString("fr")} {form.currency}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-900">{t("totalLabel")} {form.incoterm}</span>
                <span className="text-xl font-bold text-blue-600">{totalCIF.toLocaleString("fr")} {form.currency}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">{t("sectionNotes")}</h2>
          <textarea rows={3} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder={t("placeholderNotes")}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" onClick={() => router.back()}>{t("cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("creating") : t("createOrder")}
          </Button>
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
