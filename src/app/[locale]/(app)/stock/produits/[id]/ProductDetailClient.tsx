"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Package, TrendingUp, TrendingDown, Warehouse,
  Edit2, Save, X, ChevronRight, BarChart3, ShoppingCart, ShoppingBag,
  FileText, Shield, Upload, Trash2, Download, Lock, Eye, AlertTriangle,
} from "lucide-react"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/Button"

interface Product {
  id: string
  name: string
  reference: string | null
  merchant_reference: string | null
  sku: string | null
  origin: string | null
  internal_notes: string | null
  description: string | null
  buy_price: number | null
  buy_price_currency: "GNF" | "USD" | "EUR"
  sell_price: number | null
  currency: "GNF" | "USD" | "EUR"
  is_active: boolean
  can_be_sold?: boolean
  can_be_purchased?: boolean
  product_type?: "consumable" | "service" | "storable"
  barcode?: string | null
  tva_vente?: number | null
  tva_achat?: number | null
  category: { id: string; name: string; color: string } | null
  unit: { id: string; name: string; type: string } | null
  category_id?: string
  unit_id?: string
}

interface ProductDocument {
  id: string
  type: "technical_sheet" | "safety_data_sheet" | "other"
  name: string
  url: string
  file_size: number | null
  created_at: string
}

interface StockLevel {
  quantity: number
  warehouse: { id: string; name: string } | null
}

interface Move {
  id: string
  type: string
  quantity: number
  date: string
  reference: string | null
  from_warehouse_id: string | null
  to_warehouse_id: string | null
}

interface Props {
  product: Product
  stockLevels: StockLevel[]
  moves: Move[]
  documents: ProductDocument[]
  totalStock: number
  incoming: number
  outgoing: number
  categories: { id: string; name: string; color: string }[]
  units: { id: string; name: string; type: string }[]
  warehouses: { id: string; name: string }[]
  locale: string
  isAdmin: boolean
}

type Tab = "general" | "interne" | "prix" | "inventaire" | "documents" | "mouvements"

const PRODUCT_TYPES = [
  { value: "consumable", label: "Consommable" },
  { value: "storable", label: "Stockable" },
  { value: "service", label: "Service" },
]

const DOC_TYPES = [
  { value: "technical_sheet", label: "Fiche technique", icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  { value: "safety_data_sheet", label: "Fiche de sécurité (SDS)", icon: Shield, color: "text-red-600", bg: "bg-red-50" },
  { value: "other", label: "Autre", icon: FileText, color: "text-gray-600", bg: "bg-gray-50" },
]

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ProductDetailClient({
  product: initial, stockLevels, moves, documents: initialDocs,
  totalStock, incoming, outgoing,
  categories, units, warehouses, locale, isAdmin,
}: Props) {
  const router = useRouter()
  const [product, setProduct] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>("general")
  const [documents, setDocuments] = useState<ProductDocument[]>(initialDocs)
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState<"technical_sheet" | "safety_data_sheet" | "other">("technical_sheet")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: initial.name,
    reference: initial.reference ?? "",
    merchant_reference: initial.merchant_reference ?? "",
    sku: initial.sku ?? "",
    origin: initial.origin ?? "",
    internal_notes: initial.internal_notes ?? "",
    description: initial.description ?? "",
    category_id: initial.category?.id ?? "",
    unit_id: initial.unit?.id ?? "",
    product_type: initial.product_type ?? "consumable",
    can_be_sold: initial.can_be_sold ?? true,
    can_be_purchased: initial.can_be_purchased ?? true,
    sell_price: String(initial.sell_price ?? ""),
    currency: initial.currency,
    buy_price: String(initial.buy_price ?? ""),
    buy_price_currency: initial.buy_price_currency,
    tva_vente: String(initial.tva_vente ?? 18),
    tva_achat: String(initial.tva_achat ?? 18),
    barcode: initial.barcode ?? "",
  })

  function setF(key: string, val: string | boolean) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function resetForm(p: Product) {
    setForm({
      name: p.name,
      reference: p.reference ?? "",
      merchant_reference: p.merchant_reference ?? "",
      sku: p.sku ?? "",
      origin: p.origin ?? "",
      internal_notes: p.internal_notes ?? "",
      description: p.description ?? "",
      category_id: p.category?.id ?? "",
      unit_id: p.unit?.id ?? "",
      product_type: p.product_type ?? "consumable",
      can_be_sold: p.can_be_sold ?? true,
      can_be_purchased: p.can_be_purchased ?? true,
      sell_price: String(p.sell_price ?? ""),
      currency: p.currency,
      buy_price: String(p.buy_price ?? ""),
      buy_price_currency: p.buy_price_currency,
      tva_vente: String(p.tva_vente ?? 18),
      tva_achat: String(p.tva_achat ?? 18),
      barcode: p.barcode ?? "",
    })
  }

  async function save() {
    setSaving(true)
    const { db } = getCompanyClientBrowser()
    const updateData: Record<string, unknown> = {
      name: form.name,
      reference: form.reference || null,
      merchant_reference: form.merchant_reference || null,
      description: form.description || null,
      category_id: form.category_id || null,
      unit_id: form.unit_id || null,
      product_type: form.product_type,
      can_be_sold: form.can_be_sold,
      can_be_purchased: form.can_be_purchased,
      sell_price: form.sell_price ? parseFloat(form.sell_price) : null,
      currency: form.currency,
      buy_price: form.buy_price ? parseFloat(form.buy_price) : null,
      buy_price_currency: form.buy_price_currency,
      tva_vente: form.tva_vente ? parseFloat(form.tva_vente) : null,
      tva_achat: form.tva_achat ? parseFloat(form.tva_achat) : null,
      barcode: form.barcode || null,
    }
    if (isAdmin) {
      updateData.sku = form.sku || null
      updateData.origin = form.origin || null
      updateData.internal_notes = form.internal_notes || null
    }
    const { data, error } = await db.from("products").update(updateData)
      .eq("id", product.id)
      .select("*, category:product_categories(id, name, color), unit:units(id, name, type)")
      .single()
    if (!error && data) {
      setProduct(data as Product)
      setEditing(false)
    }
    setSaving(false)
  }

  async function uploadDocument(file: File) {
    setUploading(true)
    try {
      const supabase = createClient()
      const { db } = getCompanyClientBrowser()
      const ext = file.name.split(".").pop()
      const path = `${product.id}/${Date.now()}-${file.name}`
      const { error: storageError } = await supabase.storage
        .from("product-documents")
        .upload(path, file, { upsert: false })
      if (storageError) throw storageError

      const { data: urlData } = supabase.storage.from("product-documents").getPublicUrl(path)
      const { data: doc, error: dbError } = await db.from("product_documents").insert({
        product_id: product.id,
        type: uploadType,
        name: file.name,
        url: urlData.publicUrl,
        file_size: file.size,
      }).select().single()

      if (!dbError && doc) {
        setDocuments(prev => [doc as ProductDocument, ...prev])
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function deleteProduct() {
    setDeleting(true)
    const { db } = getCompanyClientBrowser()
    await db.from("products").delete().eq("id", product.id)
    router.push(`/${locale}/stock/produits`)
  }

  async function deleteDocument(docId: string, url: string) {
    const { db } = getCompanyClientBrowser()
    const supabase = createClient()
    const path = url.split("/product-documents/")[1]
    if (path) await supabase.storage.from("product-documents").remove([path])
    await db.from("product_documents").delete().eq("id", docId)
    setDocuments(prev => prev.filter(d => d.id !== docId))
  }

  const stockValue = totalStock * (product.buy_price ?? 0)
  const forecast = totalStock + incoming - outgoing

  const TABS: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: "general", label: "Général" },
    { key: "interne", label: "Référence interne", adminOnly: true },
    { key: "prix", label: "Prix" },
    { key: "inventaire", label: "Inventaire" },
    { key: "documents", label: `Documents${documents.length > 0 ? ` (${documents.length})` : ""}` },
    { key: "mouvements", label: "Mouvements" },
  ]

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin)

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-3 md:gap-4">
        <Link href={`/${locale}/stock/produits`} className="text-gray-400 hover:text-gray-600 transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
          <span className="hidden sm:inline">Produits</span>
          <ChevronRight className="w-3 h-3 hidden sm:inline" />
          <span className="text-gray-800 font-medium truncate">{product.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="secondary" onClick={() => { setEditing(false); resetForm(product) }}>
                <X className="w-4 h-4" /> <span className="hidden sm:inline">Annuler</span>
              </Button>
              <Button onClick={save} disabled={saving}>
                <Save className="w-4 h-4" /> {saving ? "…" : <span className="hidden sm:inline">Enregistrer</span>}
              </Button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                <Trash2 className="w-4 h-4" />
              </button>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Edit2 className="w-4 h-4" /> <span className="hidden sm:inline">Modifier</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Product header */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4">
          <div className="px-4 md:px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                {editing ? (
                  <input
                    value={form.name}
                    onChange={e => setF("name", e.target.value)}
                    className="text-xl md:text-2xl font-bold text-gray-900 w-full border-b-2 border-blue-500 outline-none bg-transparent pb-1"
                  />
                ) : (
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">{product.name}</h1>
                )}
                {/* References row */}
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  {(editing ? form.merchant_reference : product.merchant_reference) && (
                    <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                      <Eye className="w-3 h-3 inline mr-1 text-gray-400" />
                      {editing ? form.merchant_reference : product.merchant_reference}
                    </span>
                  )}
                  {isAdmin && (editing ? form.sku : product.sku) && (
                    <span className="text-xs text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded">
                      SKU: {editing ? form.sku : product.sku}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-3">
                  {[
                    { key: "can_be_sold", label: "Peut être vendu", icon: ShoppingCart },
                    { key: "can_be_purchased", label: "Peut être acheté", icon: ShoppingBag },
                  ].map(({ key, label, icon: Icon }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={(editing ? form : product)[key as keyof typeof form] as boolean ?? true}
                        onChange={e => editing && setF(key, e.target.checked)}
                        disabled={!editing}
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <Icon className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs md:text-sm text-gray-600">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Smart buttons */}
          <div className="flex divide-x divide-gray-100 overflow-x-auto">
            {[
              { label: "En stock", value: formatNumber(totalStock), color: totalStock < 0 ? "text-red-600" : totalStock === 0 ? "text-gray-400" : "text-blue-600", onClick: () => setTab("mouvements") },
              { label: "Entrées", value: formatNumber(incoming), color: "text-emerald-600", onClick: () => setTab("mouvements") },
              { label: "Sorties", value: formatNumber(outgoing), color: "text-red-500", onClick: () => setTab("mouvements") },
              { label: "Prévu", value: formatNumber(forecast), color: forecast < 0 ? "text-red-600" : "text-purple-600", onClick: () => setTab("inventaire") },
              ...(product.buy_price ? [{ label: "Valeur stock", value: formatCurrency(stockValue, product.buy_price_currency), color: "text-gray-700", onClick: undefined }] : []),
            ].map(({ label, value, color, onClick }) => (
              <div key={label}
                className={`flex-1 min-w-[80px] px-3 md:px-6 py-3 text-center ${onClick ? "hover:bg-gray-50 cursor-pointer" : ""} transition`}
                onClick={onClick}
              >
                <div className={`text-base md:text-xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {visibleTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 md:px-5 py-3 text-xs md:text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5 ${
                  tab === t.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.adminOnly && <Lock className="w-3 h-3" />}
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 md:p-6">

            {/* GÉNÉRAL */}
            {tab === "general" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type de produit</label>
                  {editing ? (
                    <div className="flex gap-3 flex-wrap">
                      {PRODUCT_TYPES.map(pt => (
                        <label key={pt.value} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="product_type" value={pt.value}
                            checked={form.product_type === pt.value}
                            onChange={() => setF("product_type", pt.value)}
                            className="accent-blue-600" />
                          <span className="text-sm text-gray-700">{pt.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-800">{PRODUCT_TYPES.find(t => t.value === product.product_type)?.label ?? "Consommable"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Catégorie</label>
                  {editing ? (
                    <select value={form.category_id} onChange={e => setF("category_id", e.target.value)} className={inputCls}>
                      <option value="">— Aucune —</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-800">{product.category?.name ?? "—"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Unité de mesure</label>
                  {editing ? (
                    <select value={form.unit_id} onChange={e => setF("unit_id", e.target.value)} className={inputCls}>
                      <option value="">— Aucune —</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-800">{product.unit?.name ?? "—"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Référence marchande
                    <span className="ml-1.5 text-xs text-gray-400 normal-case font-normal">(visible clients)</span>
                  </label>
                  {editing ? (
                    <input value={form.merchant_reference} onChange={e => setF("merchant_reference", e.target.value)}
                      className={inputCls} placeholder="ex: DPL-15W40-208L" />
                  ) : (
                    <p className="text-sm font-mono text-gray-800">{product.merchant_reference ?? "—"}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                  {editing ? (
                    <textarea value={form.description} onChange={e => setF("description", e.target.value)}
                      rows={3} className={`${inputCls} resize-none`} placeholder="Description du produit…" />
                  ) : (
                    <p className="text-sm text-gray-600">{product.description ?? <span className="text-gray-300 italic">Aucune description</span>}</p>
                  )}
                </div>

                {stockLevels.length > 0 && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Stock par entrepôt</label>
                    <div className="flex gap-3 flex-wrap">
                      {stockLevels.map((sl, i) => (
                        <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                          <Warehouse className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{(sl.warehouse as { name: string } | null)?.name ?? "—"}</span>
                          <span className={`text-sm font-bold ml-2 ${Number(sl.quantity) < 0 ? "text-red-600" : "text-blue-600"}`}>
                            {formatNumber(Number(sl.quantity))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RÉFÉRENCE INTERNE — admin only */}
            {tab === "interne" && isAdmin && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  Ces informations sont visibles uniquement par les administrateurs.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Référence interne</label>
                    {editing ? (
                      <input value={form.reference} onChange={e => setF("reference", e.target.value)}
                        className={inputCls} placeholder="INT-001" />
                    ) : (
                      <p className="text-sm font-mono text-gray-800">{product.reference ?? "—"}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">SKU</label>
                    {editing ? (
                      <input value={form.sku} onChange={e => setF("sku", e.target.value)}
                        className={inputCls} placeholder="ex: OIL-15W40-208-FUT" />
                    ) : (
                      <p className="text-sm font-mono text-gray-800">{product.sku ?? "—"}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Pays d'origine</label>
                    {editing ? (
                      <input value={form.origin} onChange={e => setF("origin", e.target.value)}
                        className={inputCls} placeholder="ex: France, Singapour…" />
                    ) : (
                      <p className="text-sm text-gray-800">{product.origin ?? "—"}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes internes</label>
                  {editing ? (
                    <textarea value={form.internal_notes} onChange={e => setF("internal_notes", e.target.value)}
                      rows={4} className={`${inputCls} resize-none`}
                      placeholder="Fournisseurs préférés, conditions de stockage, notes logistiques…" />
                  ) : (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{product.internal_notes ?? <span className="text-gray-300 italic">Aucune note</span>}</p>
                  )}
                </div>
              </div>
            )}

            {/* PRIX */}
            {tab === "prix" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Prix de vente</label>
                  {editing ? (
                    <div className="flex gap-2">
                      <input type="number" value={form.sell_price} onChange={e => setF("sell_price", e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0" />
                      <select value={form.currency} onChange={e => setF("currency", e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {["GNF", "USD", "EUR"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-gray-900">{product.sell_price ? formatCurrency(product.sell_price, product.currency) : "—"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">TVA vente (%)</label>
                  {editing ? (
                    <input type="number" value={form.tva_vente} onChange={e => setF("tva_vente", e.target.value)}
                      className={inputCls} placeholder="18" />
                  ) : (
                    <p className="text-sm text-gray-800">{product.tva_vente ?? 18}%</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Coût (prix d'achat)</label>
                  {editing ? (
                    <div className="flex gap-2">
                      <input type="number" value={form.buy_price} onChange={e => setF("buy_price", e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0" />
                      <select value={form.buy_price_currency} onChange={e => setF("buy_price_currency", e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {["GNF", "USD", "EUR"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-gray-900">{product.buy_price ? formatCurrency(product.buy_price, product.buy_price_currency) : "—"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">TVA achat (%)</label>
                  {editing ? (
                    <input type="number" value={form.tva_achat} onChange={e => setF("tva_achat", e.target.value)}
                      className={inputCls} placeholder="18" />
                  ) : (
                    <p className="text-sm text-gray-800">{product.tva_achat ?? 18}%</p>
                  )}
                </div>

                {product.sell_price && product.buy_price && (
                  <div className="sm:col-span-2 bg-blue-50 rounded-xl p-4 flex flex-wrap gap-8">
                    <div>
                      <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Marge brute</p>
                      <p className="text-lg font-bold text-blue-700">{formatCurrency(product.sell_price - product.buy_price, product.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Taux de marge</p>
                      <p className="text-lg font-bold text-blue-700">{((product.sell_price - product.buy_price) / product.buy_price * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INVENTAIRE */}
            {tab === "inventaire" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Code-barres</label>
                  {editing ? (
                    <input value={form.barcode} onChange={e => setF("barcode", e.target.value)}
                      className={inputCls} placeholder="5901234123457" />
                  ) : (
                    <p className="text-sm font-mono text-gray-800">{product.barcode ?? "—"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Quantité disponible</label>
                  <p className={`text-2xl font-bold ${totalStock < 0 ? "text-red-600" : totalStock === 0 ? "text-gray-400" : "text-blue-600"}`}>
                    {formatNumber(totalStock)} <span className="text-sm font-normal text-gray-500">{initial.unit?.name ?? "Unité"}</span>
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prévision de stock</label>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Warehouse className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">{warehouses[0]?.name ?? "Entrepôt principal"}</span>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4 text-center overflow-x-auto">
                      {[
                        { label: "Disponible", value: formatNumber(totalStock), color: "text-blue-600" },
                        { label: "+", value: null, color: "text-gray-300" },
                        { label: "Entrant", value: formatNumber(incoming), color: "text-emerald-600" },
                        { label: "−", value: null, color: "text-gray-300" },
                        { label: "Sortant", value: formatNumber(outgoing), color: "text-red-500" },
                        { label: "=", value: null, color: "text-gray-300" },
                        { label: "Prévu", value: formatNumber(forecast), color: forecast < 0 ? "text-red-600" : "text-purple-600" },
                      ].map(({ label, value, color }, i) => value !== null ? (
                        <div key={i} className="flex-1 min-w-[60px]">
                          <p className={`text-xl font-bold ${color}`}>{value}</p>
                          <p className="text-xs text-gray-500 mt-1">{label}</p>
                        </div>
                      ) : (
                        <div key={i} className={`text-xl font-light ${color}`}>{label}</div>
                      ))}
                    </div>
                    {forecast < 0 && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600 font-medium">
                        ⚠ Stock insuffisant — réapprovisionnement recommandé
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* DOCUMENTS */}
            {tab === "documents" && (
              <div className="space-y-6">
                {/* Upload zone */}
                {isAdmin && (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600 mb-3">Ajouter un document</p>
                    <div className="flex justify-center gap-2 mb-4 flex-wrap">
                      {DOC_TYPES.map(dt => (
                        <button key={dt.value}
                          onClick={() => setUploadType(dt.value as typeof uploadType)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                            uploadType === dt.value
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                          }`}>
                          {dt.label}
                        </button>
                      ))}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
                      className="hidden"
                      onChange={e => { if (e.target.files?.[0]) uploadDocument(e.target.files[0]) }}
                    />
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Upload className="w-4 h-4" />
                      {uploading ? "Envoi en cours…" : "Choisir un fichier"}
                    </Button>
                    <p className="text-xs text-gray-400 mt-2">PDF, Word, Excel, images — max 20 MB</p>
                  </div>
                )}

                {/* Documents by type */}
                {DOC_TYPES.map(dt => {
                  const docs = documents.filter(d => d.type === dt.value)
                  if (docs.length === 0 && !isAdmin) return null
                  return (
                    <div key={dt.value}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-7 h-7 rounded-lg ${dt.bg} flex items-center justify-center`}>
                          <dt.icon className={`w-4 h-4 ${dt.color}`} />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-700">{dt.label}</h3>
                        <span className="text-xs text-gray-400">({docs.length})</span>
                      </div>
                      {docs.length === 0 ? (
                        <p className="text-sm text-gray-400 italic pl-9">Aucun document</p>
                      ) : (
                        <div className="space-y-2 pl-9">
                          {docs.map(doc => (
                            <div key={doc.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 group">
                              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                                <p className="text-xs text-gray-400">
                                  {formatFileSize(doc.file_size)} · {formatDate(doc.created_at, locale)}
                                </p>
                              </div>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                className="text-gray-400 hover:text-blue-600 transition p-1">
                                <Download className="w-4 h-4" />
                              </a>
                              {isAdmin && (
                                <button onClick={() => deleteDocument(doc.id, doc.url)}
                                  className="text-gray-300 hover:text-red-500 transition p-1 opacity-0 group-hover:opacity-100">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {documents.length === 0 && !isAdmin && (
                  <div className="text-center py-12 text-gray-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Aucun document disponible</p>
                  </div>
                )}
              </div>
            )}

            {/* MOUVEMENTS */}
            {tab === "mouvements" && (
              <div>
                <p className="text-sm text-gray-500 mb-4">{moves.length} mouvement{moves.length !== 1 ? "s" : ""}</p>
                {moves.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Aucun mouvement enregistré</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {moves.map(m => (
                      <div key={m.id} className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          m.type === "in" ? "bg-emerald-100" : m.type === "out" ? "bg-red-100" : "bg-blue-100"
                        }`}>
                          {m.type === "in" ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                            : m.type === "out" ? <TrendingDown className="w-4 h-4 text-red-500" />
                            : <BarChart3 className="w-4 h-4 text-blue-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {m.type === "in" ? "Entrée" : m.type === "out" ? "Sortie" : "Transfert"}
                            {m.reference && <span className="ml-2 text-xs text-gray-400 font-mono">{m.reference}</span>}
                          </p>
                          <p className="text-xs text-gray-400">{formatDate(m.date, locale)}</p>
                        </div>
                        <div className={`text-sm font-bold ${m.type === "in" ? "text-emerald-600" : m.type === "out" ? "text-red-500" : "text-blue-600"}`}>
                          {m.type === "in" ? "+" : m.type === "out" ? "−" : "↔"}{formatNumber(Number(m.quantity))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Supprimer ce produit ?</h3>
                <p className="text-sm text-gray-500 mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3 mb-5">
              <span className="font-semibold">{product.name}</span> sera définitivement supprimé, ainsi que tous ses mouvements de stock et documents.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
                Annuler
              </button>
              <button onClick={deleteProduct} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition disabled:opacity-50">
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
