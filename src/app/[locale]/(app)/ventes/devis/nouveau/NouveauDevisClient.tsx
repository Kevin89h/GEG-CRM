"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Printer, Check, X, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatNumber } from "@/lib/utils"

/* ─── Types ─────────────────────────────────────────────── */
interface Account  { id: string; name: string; salesperson_id: string | null }
interface Contact  { id: string; first_name: string; last_name: string; account_id: string | null }
interface Product  { id: string; name: string; reference: string | null; sell_price: number | null; currency: string; unit: { id: string; name: string } | null }
interface Employee { id: string; full_name: string; commission_rate: number }
interface Unit     { id: string; name: string; type: string }

interface Props {
  accounts:  Account[]
  contacts:  Contact[]
  products:  Product[]
  employees: Employee[]
  units:     Unit[]
  locale:    string
}

type LineKind = "product" | "note"
interface Line {
  id: number
  kind: LineKind
  product_id: string
  description: string
  quantity: string
  unit_id: string
  unit_price: string
  discount: string
}

type Currency = "GNF" | "USD" | "EUR"

let _id = 0
const uid = () => ++_id

function newProductLine(): Line {
  return { id: uid(), kind: "product", product_id: "", description: "", quantity: "1", unit_id: "", unit_price: "0", discount: "0" }
}
function newNoteLine(): Line {
  return { id: uid(), kind: "note", product_id: "", description: "", quantity: "", unit_id: "", unit_price: "", discount: "" }
}

/* ─── Composant autocomplete client ──────────────────────── */
function AccountPicker({ accounts, value, onSelect, onCreateNew }: {
  accounts: Account[]
  value: string
  onSelect: (id: string) => void
  onCreateNew: () => void
}) {
  const t = useTranslations("devis")
  const [query, setQuery] = useState("")
  const [open, setOpen]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = accounts.find(a => a.id === value)

  const filtered = query.length > 0
    ? accounts.filter(a => a.name.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : accounts.slice(0, 10)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => { setOpen(true); setQuery("") }}
        className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg bg-white cursor-text min-h-[36px] min-w-[280px]"
      >
        {selected && !open ? (
          <span className="text-sm text-blue-700 font-medium flex-1">{selected.name}</span>
        ) : (
          <input
            autoFocus={open}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            placeholder={t("tapezPourTrouverUnClient")}
            className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
          />
        )}
        {selected && !open && (
          <button onClick={e => { e.stopPropagation(); onSelect(""); setQuery("") }} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[320px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && query && (
              <p className="px-4 py-2 text-sm text-gray-400">{t("aucunResultatPour", { query })}</p>
            )}
            {filtered.map(a => (
              <button
                key={a.id}
                onMouseDown={() => { onSelect(a.id); setOpen(false); setQuery("") }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors"
              >
                {a.name}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100">
            <button
              onMouseDown={() => { setOpen(false); onCreateNew() }}
              className="w-full text-left px-4 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span> {t("nouveauClient")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Composant autocomplete produit ─────────────────────── */
function ProductPicker({ products, value, onChange, onCreateNew, lineIndex }: {
  products: Product[]
  value: string
  onChange: (productId: string) => void
  onCreateNew: (lineIndex: number) => void
  lineIndex: number
}) {
  const t = useTranslations("devis")
  const [query, setQuery] = useState("")
  const [open, setOpen]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = products.find(p => p.id === value)

  const filtered = query.length > 0
    ? products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.reference ?? "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, 12)
    : products.slice(0, 12)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => { setOpen(true); setQuery("") }}
        className="flex items-center gap-1.5 cursor-text min-w-[180px]"
      >
        {selected && !open ? (
          <span className="text-sm text-blue-700 font-medium">{selected.name}</span>
        ) : (
          <input
            autoFocus={open}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            placeholder={t("chercherUnProduit")}
            className="w-full text-sm outline-none bg-transparent placeholder-gray-400"
          />
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 min-w-[300px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-4 py-2 text-sm text-gray-400">{t("aucunProduitTrouve")}</p>
            )}
            {filtered.map(p => (
              <button
                key={p.id}
                onMouseDown={() => { onChange(p.id); setOpen(false); setQuery("") }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors"
              >
                <span className="font-medium">{p.name}</span>
                {p.reference && <span className="text-xs text-gray-400 ml-2 font-mono">[{p.reference}]</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100">
            <button
              onMouseDown={() => { setOpen(false); onCreateNew(lineIndex) }}
              className="w-full text-left px-4 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span> {t("nouveauProduit")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Modal wrapper ──────────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ─── Composant principal ────────────────────────────────── */
export default function NouveauDevisClient({
  accounts: initAccounts, contacts, products: initProducts, employees, units, locale,
}: Props) {
  const router = useRouter()
  const t = useTranslations("devis")

  const [accounts, setAccounts] = useState(initAccounts)
  const [products, setProducts] = useState(initProducts)
  const [lines, setLines]       = useState<Line[]>([])
  const [activeTab, setActiveTab] = useState<"lines" | "other">("lines")
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const today = new Date().toISOString().split("T")[0]
  const [form, setForm] = useState({
    account_id: "", contact_id: "", salesperson_id: "",
    commission_rate: "0", currency: "GNF" as Currency,
    date_order: today, valid_until: "", payment_terms: "",
    client_order_ref: "", notes: "",
    tva: false,
  })

  /* Modal client */
  const [showClientModal, setShowClientModal] = useState(false)
  const [cForm, setCForm] = useState({ name: "", type: "prospect" as "prospect" | "client", phone: "", email: "", country: "Guinée" })
  const [cSaving, setCSaving] = useState(false)
  const [cError,  setCError]  = useState<string | null>(null)

  /* Modal produit */
  const [showProductModal, setShowProductModal] = useState(false)
  const [pendingLineIndex,  setPendingLineIndex] = useState<number | null>(null)
  const [pForm, setPForm] = useState({ name: "", reference: "", sell_price: "", unit_id: "" })
  const [pSaving, setPSaving] = useState(false)
  const [pError,  setPError]  = useState<string | null>(null)

  const PAYMENT_TERMS = [
    { value: "",          label: t("paymentTermImmediat") },
    { value: "15j",       label: t("paymentTerm15j") },
    { value: "30j",       label: t("paymentTerm30j") },
    { value: "45j",       label: t("paymentTerm45j") },
    { value: "60j",       label: t("paymentTerm60j") },
    { value: "avance",    label: t("paymentTermAvance") },
  ]

  /* ── Helpers form ── */
  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function onAccountChange(id: string) {
    const acct = accounts.find(a => a.id === id)
    const emp  = acct?.salesperson_id ? employees.find(e => e.id === acct.salesperson_id) : null
    setForm(f => ({
      ...f, account_id: id, contact_id: "",
      salesperson_id:   emp?.id ?? f.salesperson_id,
      commission_rate:  emp ? String(emp.commission_rate) : f.commission_rate,
    }))
  }

  /* ── Helpers lignes ── */
  function addProductLine() { setLines(ls => [...ls, newProductLine()]) }
  function addNoteLine()    { setLines(ls => [...ls, newNoteLine()]) }

  function updateLine(lineId: number, patch: Partial<Line>) {
    setLines(ls => ls.map(l => l.id === lineId ? { ...l, ...patch } : l))
  }

  function onProductSelected(lineId: number, productId: string) {
    const p = products.find(p => p.id === productId)
    updateLine(lineId, {
      product_id:  productId,
      description: p?.name ?? "",
      unit_price:  String(p?.sell_price ?? 0),
      unit_id:     p?.unit?.id ?? "",
    })
  }

  function removeLine(lineId: number) {
    setLines(ls => ls.filter(l => l.id !== lineId))
  }

  function lineTotal(l: Line) {
    if (l.kind === "note") return 0
    return (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0) * (1 - (parseFloat(l.discount) || 0) / 100)
  }

  const total = lines.reduce((s, l) => s + lineTotal(l), 0)
  const filteredContacts = contacts.filter(c => !form.account_id || c.account_id === form.account_id)

  /* ── Création client ── */
  async function handleCreateClient() {
    if (!cForm.name.trim()) { setCError(t("erreurNomRequis")); return }
    setCSaving(true); setCError(null)
    const { db } = getCompanyClientBrowser()
    const { data, error: err } = await db
      .from("accounts")
      .insert([{ name: cForm.name.trim(), type: cForm.type, phone: cForm.phone || null, email: cForm.email || null, country: cForm.country || null, is_active: true }])
      .select("id, name, salesperson_id").single()
    if (err || !data) { setCError(err?.message ?? t("erreur")); setCSaving(false); return }
    setAccounts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    onAccountChange(data.id)
    setShowClientModal(false)
    setCForm({ name: "", type: "prospect", phone: "", email: "", country: "Guinée" })
    setCSaving(false)
  }

  /* ── Création produit ── */
  function openProductModal(lineIndex: number) {
    setPendingLineIndex(lineIndex)
    setPForm({ name: "", reference: "", sell_price: "", unit_id: units[0]?.id ?? "" })
    setPError(null)
    setShowProductModal(true)
  }

  async function handleCreateProduct() {
    if (!pForm.name.trim()) { setPError(t("erreurNomRequis")); return }
    setPSaving(true); setPError(null)
    const { db } = getCompanyClientBrowser()
    const { data, error: err } = await db
      .from("products")
      .insert([{ name: pForm.name.trim(), reference: pForm.reference || null, sell_price: pForm.sell_price ? parseFloat(pForm.sell_price) : null, currency: form.currency, unit_id: pForm.unit_id || null, is_active: true }])
      .select("id, name, reference, sell_price, currency, unit_id").single()
    if (err || !data) { setPError(err?.message ?? t("erreur")); setPSaving(false); return }
    const unitObj = units.find(u => u.id === data.unit_id) ?? null
    const productWithUnit = { ...data, unit: unitObj ? { id: unitObj.id, name: unitObj.name } : null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setProducts(prev => [...prev, productWithUnit as any].sort((a, b) => a.name.localeCompare(b.name)))
    if (pendingLineIndex !== null) {
      const targetLine = lines[pendingLineIndex]
      if (targetLine) {
        updateLine(targetLine.id, {
          product_id: data.id,
          description: data.name,
          unit_price: String(data.sell_price ?? 0),
          unit_id: unitObj?.id ?? "",
        })
      }
    }
    setShowProductModal(false)
    setPSaving(false)
  }

  /* ── Enregistrement ── */
  async function handleSave() {
    if (!form.account_id) { setError(t("veuillezselectionnerclient")); return }
    const productLines = lines.filter(l => l.kind === "product")
    if (productLines.length === 0) { setError(t("ajoutezAuMoinsUnProduit")); return }
    if (productLines.some(l => !l.description.trim())) { setError(t("chaqueLineProduitDescription")); return }

    setSaving(true); setError(null)
    const { supabase, db } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError(t("nonAuthentifie")); setSaving(false); return }

    // Générer un numéro unique basé sur le timestamp
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const { count } = await db.from("sales_orders").select("*", { count: "exact", head: true })
    const seq = String((count ?? 0) + 1).padStart(4, "0")
    const number = `DEV-${year}-${month}-${seq}`

    const payload: Record<string, unknown> = {
      number,
      account_id: form.account_id,
      contact_id: form.contact_id || null,
      salesperson_id: form.salesperson_id || null,
      commission_rate: parseFloat(form.commission_rate) || null,
      currency: form.currency,
      valid_until: form.valid_until || null,
      notes: form.notes || null,
      payment_terms: form.payment_terms || null,
      client_order_ref: form.client_order_ref || null,
      date_order: form.date_order || null,
      tva: form.tva,
      user_id: user.id,
    }

    const { data: order, error: err } = await db.from("sales_orders").insert([payload]).select("id").single()
    if (err || !order) { setError(err?.message ?? t("erreur")); setSaving(false); return }

    const lineRows = lines.map((l, i) => {
      return {
        order_id: order.id, product_id: l.product_id || null, description: l.description,
        quantity: parseFloat(l.quantity) || 1, unit_price: parseFloat(l.unit_price) || 0,
        discount: parseFloat(l.discount) || 0, position: i,
      }
    })

    const { error: lineErr } = await db.from("sales_order_lines").insert(lineRows)
    if (lineErr) { setError(lineErr.message); setSaving(false); return }

    router.push(`/${locale}/ventes/devis/${order.id}`)
    router.refresh()
  }

  /* ─── Rendu ─────────────────────────────────────────────── */
  return (
    <div className="max-w-5xl mx-auto pb-16">

      {/* Barre du haut style Odoo */}
      <div className="flex items-center gap-2 mb-0 py-3 border-b border-gray-100 bg-gray-50 px-0 -mx-4 px-4 mb-4">
        <Link href={`/${locale}/ventes/devis`} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> {t("devis")}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-700 font-medium">{t("nouveau")}</span>
      </div>

      {/* Boutons d'action style Odoo */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={handleSave}
          disabled={saving || !form.account_id}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
        >
          <Check className="w-4 h-4" />
          {saving ? t("enregistrement") : t("confirmer")}
        </button>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
          <Printer className="w-4 h-4" /> {t("imprimer")}
        </button>
        <button onClick={() => router.back()} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
          {t("annuler")}
        </button>

        {/* Stepper status */}
        <div className="ml-auto flex items-center gap-0">
          {([t("statusDevis"), t("statusEnvoye"), t("statusBonDeCommande")] as const).map((s, i) => (
            <div key={s} className={`flex items-center ${i > 0 ? "-ml-2" : ""}`}>
              <div className={`px-4 py-1.5 text-xs font-semibold rounded-full border-2 ${
                i === 0
                  ? "bg-blue-600 border-blue-600 text-white z-10 relative"
                  : "bg-white border-gray-200 text-gray-400"
              }`}>
                {s}
              </div>
              {i < 2 && <div className="w-4 h-0.5 bg-gray-200" />}
            </div>
          ))}
        </div>
      </div>

      {/* Corps du formulaire — style document Odoo */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Zone en-tête du document */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <h1 className="text-3xl font-light text-gray-800 mb-6">{t("nouveau")}</h1>
          <div className="grid grid-cols-2 gap-x-16 gap-y-4 text-sm">
            {/* Col gauche */}
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                <label className="w-36 shrink-0 text-gray-600 pt-1.5">{t("client")}</label>
                <AccountPicker
                  accounts={accounts}
                  value={form.account_id}
                  onSelect={onAccountChange}
                  onCreateNew={() => setShowClientModal(true)}
                />
              </div>

              {form.account_id && filteredContacts.length > 0 && (
                <div className="flex items-center gap-4">
                  <label className="w-36 shrink-0 text-gray-600">{t("contact")}</label>
                  <select
                    value={form.contact_id}
                    onChange={e => setF("contact_id", e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                  >
                    <option value="">—</option>
                    {filteredContacts.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-gray-600">{t("vendeur")}</label>
                <select
                  value={form.salesperson_id}
                  onChange={e => {
                    const emp = employees.find(em => em.id === e.target.value)
                    setForm(f => ({ ...f, salesperson_id: e.target.value, commission_rate: emp ? String(emp.commission_rate) : "0" }))
                  }}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                >
                  <option value="">{t("aucun")}</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-gray-600">{t("refClient")}</label>
                <input
                  value={form.client_order_ref}
                  onChange={e => setF("client_order_ref", e.target.value)}
                  placeholder="Ex: PO-2026-001"
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                />
              </div>
            </div>

            {/* Col droite */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="w-40 shrink-0 text-gray-600">{t("expiration")}</label>
                <input
                  type="date" value={form.valid_until}
                  onChange={e => setF("valid_until", e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-start gap-4">
                <label className="w-40 shrink-0 text-gray-600 pt-1.5">{t("conditionsDePaiement")}</label>
                <div className="flex flex-col gap-2 min-w-[200px]">
                  <select
                    value={PAYMENT_TERMS.some(pt => pt.value === form.payment_terms) ? form.payment_terms : "__custom__"}
                    onChange={e => {
                      if (e.target.value !== "__custom__") setF("payment_terms", e.target.value)
                    }}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PAYMENT_TERMS.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                    {!PAYMENT_TERMS.some(pt => pt.value === form.payment_terms) && form.payment_terms !== "" && (
                      <option value="__custom__">{form.payment_terms}</option>
                    )}
                  </select>
                  <input
                    type="text"
                    value={form.payment_terms}
                    onChange={e => setF("payment_terms", e.target.value)}
                    placeholder={t("paymentTermsComment")}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 placeholder-gray-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="w-40 shrink-0 text-gray-600">{t("devise")}</label>
                <select
                  value={form.currency}
                  onChange={e => setF("currency", e.target.value as Currency)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GNF">GNF</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-gray-100 px-8">
          {(["lines", "other"] as const).map(tab => {
            const labels = { lines: t("lignesDeLaCommande"), other: t("autresInformations") }
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-0 mr-8 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {labels[tab]}
              </button>
            )
          })}
        </div>

        {/* Onglet lignes — style Odoo */}
        {activeTab === "lines" && (
          <div>
            {lines.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-gray-500 border-b border-gray-100">
                    <th className="text-left px-8 py-2.5 font-medium">{t("produit")}</th>
                    <th className="text-right px-3 py-2.5 font-medium w-20">{t("quantite")}</th>
                    <th className="text-left px-3 py-2.5 font-medium w-24">{t("unite")}</th>
                    <th className="text-right px-3 py-2.5 font-medium w-32">{t("prixUnitaire")}</th>
                    <th className="text-right px-3 py-2.5 font-medium w-20">{t("remise")}</th>
                    <th className="text-right px-8 py-2.5 font-medium w-32">{t("montant")}</th>
                    <th className="w-8 pr-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lines.map((l, i) => (
                    <tr key={l.id} className="group hover:bg-gray-50/50">
                      {l.kind === "note" ? (
                        <>
                          <td colSpan={5} className="px-8 py-2">
                            <input
                              value={l.description}
                              onChange={e => updateLine(l.id, { description: e.target.value })}
                              placeholder={t("notePlaceholder")}
                              className="w-full text-sm text-gray-500 italic outline-none bg-transparent border-b border-dashed border-gray-200 focus:border-blue-400 py-0.5"
                            />
                          </td>
                          <td className="px-8 py-2 text-right text-gray-400 text-xs">note</td>
                          <td className="pr-2 py-2">
                            <button onClick={() => removeLine(l.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-8 py-2">
                            <ProductPicker
                              products={products}
                              value={l.product_id}
                              onChange={productId => onProductSelected(l.id, productId)}
                              onCreateNew={() => openProductModal(i)}
                              lineIndex={i}
                            />
                            {l.product_id && (
                              <input
                                value={l.description}
                                onChange={e => updateLine(l.id, { description: e.target.value })}
                                placeholder={t("descriptionPlaceholder")}
                                className="mt-0.5 w-full text-xs text-gray-500 outline-none bg-transparent border-b border-dashed border-transparent focus:border-gray-300 py-0.5"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" step="any" value={l.quantity}
                              onChange={e => updateLine(l.id, { quantity: e.target.value })}
                              className="w-full text-right text-sm outline-none bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-400 py-0.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={l.unit_id}
                              onChange={e => updateLine(l.id, { unit_id: e.target.value })}
                              className="w-full text-sm bg-transparent outline-none border-b border-transparent hover:border-gray-200 focus:border-blue-400 py-0.5"
                            >
                              <option value="">—</option>
                              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" step="any" value={l.unit_price}
                              onChange={e => updateLine(l.id, { unit_price: e.target.value })}
                              className="w-full text-right text-sm outline-none bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-400 py-0.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" max="100" step="0.1" value={l.discount}
                              onChange={e => updateLine(l.id, { discount: e.target.value })}
                              className="w-full text-right text-sm outline-none bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-400 py-0.5"
                            />
                          </td>
                          <td className="px-8 py-2 text-right text-sm font-medium text-gray-800 whitespace-nowrap">
                            {formatNumber(lineTotal(l))}
                          </td>
                          <td className="pr-2 py-2">
                            <button onClick={() => removeLine(l.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Liens Ajouter — style Odoo */}
            <div className="px-8 py-3 flex items-center gap-5 border-t border-gray-50">
              <button onClick={addProductLine} className="text-sm text-blue-600 hover:text-blue-500 font-medium transition-colors">
                {t("ajouterUnProduit")}
              </button>
              <button onClick={addNoteLine} className="text-sm text-blue-600 hover:text-blue-500 font-medium transition-colors">
                {t("ajouterUneNote")}
              </button>
            </div>

            {/* Zone conditions + totaux */}
            <div className="border-t border-gray-100 px-8 py-5 flex gap-8">
              <div className="flex-1">
                <textarea
                  value={form.notes}
                  onChange={e => setF("notes", e.target.value)}
                  rows={3}
                  placeholder={t("conditionsGenerales")}
                  className="w-full text-sm text-gray-500 outline-none bg-transparent border-0 resize-none placeholder-gray-300 focus:placeholder-gray-400"
                />
              </div>
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>{t("montantHt")}</span>
                  <span className="font-medium">{formatNumber(total)} {form.currency}</span>
                </div>
                {/* Toggle TVA */}
                <div className="flex items-center justify-between text-gray-500 py-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setF("tva", !form.tva)}
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${form.tva ? "bg-blue-600" : "bg-gray-200"}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.tva ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-sm">{t("tva18")}</span>
                  </label>
                  {form.tva && (
                    <span className="font-medium text-gray-700">{formatNumber(total * 0.18)} {form.currency}</span>
                  )}
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200">
                  <span>{t("totalTtc")}</span>
                  <span>{formatNumber(total * (form.tva ? 1.18 : 1))} {form.currency}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Onglet autres infos */}
        {activeTab === "other" && (
          <div className="px-8 py-6 grid grid-cols-2 gap-x-16 gap-y-4 text-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="w-44 shrink-0 text-gray-600">{t("tauxDeCommission")}</label>
                <input
                  type="number" min="0" max="100" step="0.1" value={form.commission_rate}
                  onChange={e => setF("commission_rate", e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-28 text-right"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="w-44 shrink-0 text-gray-600">{t("dateDeCommande")}</label>
                <input
                  type="date" value={form.date_order}
                  onChange={e => setF("date_order", e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* ── Modal Nouveau client ─────────────────────────────── */}
      {showClientModal && (
        <Modal title={t("modalNouveauClient")} onClose={() => setShowClientModal(false)}>
          <div className="space-y-4">
            <LabeledInput label={t("nomLabel")} value={cForm.name} onChange={v => setCForm(f => ({ ...f, name: v }))} placeholder={t("nomPlaceholder")} autoFocus />
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{t("typeLabel")}</label>
              <div className="flex gap-2">
                {[{ v: "prospect", l: "Prospect" }, { v: "client", l: "Client" }].map(({ v, l }) => (
                  <button key={v} type="button"
                    onClick={() => setCForm(f => ({ ...f, type: v as "prospect" | "client" }))}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${cForm.type === v ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  >{l}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput label={t("telephoneLabel")} value={cForm.phone} onChange={v => setCForm(f => ({ ...f, phone: v }))} placeholder="+224 6xx xxx xxx" />
              <LabeledInput label={t("paysLabel")} value={cForm.country} onChange={v => setCForm(f => ({ ...f, country: v }))} />
            </div>
            <LabeledInput label={t("emailLabel")} type="email" value={cForm.email} onChange={v => setCForm(f => ({ ...f, email: v }))} placeholder="contact@entreprise.com" />
            {cError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{cError}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowClientModal(false)} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">{t("annuler")}</button>
              <button onClick={handleCreateClient} disabled={cSaving || !cForm.name.trim()} className="flex-1 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40">
                {cSaving ? t("creationEnCours") : t("creerEtSelectionner")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal Nouveau produit ────────────────────────────── */}
      {showProductModal && (
        <Modal title={t("modalNouveauProduit")} onClose={() => setShowProductModal(false)}>
          <div className="space-y-4">
            <LabeledInput label={t("nomDuProduitLabel")} value={pForm.name} onChange={v => setPForm(f => ({ ...f, name: v }))} placeholder={t("nomDuProduitPlaceholder")} autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput label={t("referenceLabel")} value={pForm.reference} onChange={v => setPForm(f => ({ ...f, reference: v }))} placeholder="LUB-20L" />
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{t("uniteDeMesureLabel")}</label>
                <select
                  value={pForm.unit_id}
                  onChange={e => setPForm(f => ({ ...f, unit_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">—</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <LabeledInput label={t("prixDeVenteLabel", { currency: form.currency })} type="number" value={pForm.sell_price} onChange={v => setPForm(f => ({ ...f, sell_price: v }))} placeholder="0" />
            {pError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{pError}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowProductModal(false)} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">{t("annuler")}</button>
              <button onClick={handleCreateProduct} disabled={pSaving || !pForm.name.trim()} className="flex-1 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40">
                {pSaving ? t("creationEnCours") : t("creerEtAjouter")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function LabeledInput({ label, value, onChange, type = "text", placeholder = "", autoFocus = false }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; autoFocus?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input
        autoFocus={autoFocus} type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      />
    </div>
  )
}
