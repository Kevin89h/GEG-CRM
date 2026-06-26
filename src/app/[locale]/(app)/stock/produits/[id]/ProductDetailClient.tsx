"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Package, TrendingUp, TrendingDown, Warehouse,
  Edit2, Save, X, ChevronRight, BarChart3, ShoppingCart, ShoppingBag,
} from "lucide-react"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/Button"

interface Product {
  id: string
  name: string
  reference: string | null
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
  totalStock: number
  incoming: number
  outgoing: number
  categories: { id: string; name: string; color: string }[]
  units: { id: string; name: string; type: string }[]
  warehouses: { id: string; name: string }[]
  locale: string
}

type Tab = "general" | "prix" | "inventaire" | "mouvements"

const PRODUCT_TYPES = [
  { value: "consumable", label: "Consommable" },
  { value: "storable", label: "Stockable" },
  { value: "service", label: "Service" },
]

export default function ProductDetailClient({
  product: initial, stockLevels, moves, totalStock, incoming, outgoing,
  categories, units, warehouses, locale,
}: Props) {
  const router = useRouter()
  const [product, setProduct] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>("general")
  const [form, setForm] = useState({
    name: initial.name,
    reference: initial.reference ?? "",
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

  async function save() {
    setSaving(true)
    const { db } = getCompanyClientBrowser()
    const { data, error } = await db.from("products").update({
      name: form.name,
      reference: form.reference || null,
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
    }).eq("id", product.id).select("*, category:product_categories(id, name, color), unit:units(id, name, type)").single()
    if (!error && data) {
      setProduct(data as Product)
      setEditing(false)
    }
    setSaving(false)
  }

  const stockValue = totalStock * (product.buy_price ?? 0)
  const forecast = totalStock + incoming - outgoing

  const TABS: { key: Tab; label: string }[] = [
    { key: "general", label: "Informations générales" },
    { key: "prix", label: "Prix" },
    { key: "inventaire", label: "Inventaire" },
    { key: "mouvements", label: "Mouvements" },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <Link href={`/${locale}/stock/produits`} className="text-gray-400 hover:text-gray-600 transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Produits</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-800 font-medium">{product.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="secondary" onClick={() => { setEditing(false); setForm({ name: product.name, reference: product.reference ?? "", description: product.description ?? "", category_id: product.category?.id ?? "", unit_id: product.unit?.id ?? "", product_type: product.product_type ?? "consumable", can_be_sold: product.can_be_sold ?? true, can_be_purchased: product.can_be_purchased ?? true, sell_price: String(product.sell_price ?? ""), currency: product.currency, buy_price: String(product.buy_price ?? ""), buy_price_currency: product.buy_price_currency, tva_vente: String(product.tva_vente ?? 18), tva_achat: String(product.tva_achat ?? 18), barcode: product.barcode ?? "" }) }}>
                <X className="w-4 h-4" /> Annuler
              </Button>
              <Button onClick={save} disabled={saving}>
                <Save className="w-4 h-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Edit2 className="w-4 h-4" /> Modifier
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Product header */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4">
          {/* Name + checkboxes */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Package className="w-8 h-8 text-blue-400" />
              </div>
              <div className="flex-1">
                {editing ? (
                  <input
                    value={form.name}
                    onChange={e => setF("name", e.target.value)}
                    className="text-2xl font-bold text-gray-900 w-full border-b-2 border-blue-500 outline-none bg-transparent pb-1"
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
                )}
                <div className="flex items-center gap-6 mt-3">
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
                      <span className="text-sm text-gray-600">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Smart buttons */}
          <div className="flex divide-x divide-gray-100">
            <div className="flex-1 px-6 py-3 text-center hover:bg-gray-50 transition cursor-pointer" onClick={() => setTab("mouvements")}>
              <div className={`text-xl font-bold ${totalStock < 0 ? "text-red-600" : totalStock === 0 ? "text-gray-400" : "text-blue-600"}`}>
                {formatNumber(totalStock)} <span className="text-sm font-normal text-gray-500">Unité</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">En stock</div>
            </div>
            <div className="flex-1 px-6 py-3 text-center hover:bg-gray-50 transition cursor-pointer" onClick={() => setTab("mouvements")}>
              <div className="text-xl font-bold text-emerald-600">
                {formatNumber(incoming)} <span className="text-sm font-normal text-gray-500">Unité</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Entrées</div>
            </div>
            <div className="flex-1 px-6 py-3 text-center hover:bg-gray-50 transition cursor-pointer" onClick={() => setTab("mouvements")}>
              <div className="text-xl font-bold text-red-500">
                {formatNumber(outgoing)} <span className="text-sm font-normal text-gray-500">Unité</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Sorties</div>
            </div>
            <div className="flex-1 px-6 py-3 text-center hover:bg-gray-50 transition cursor-pointer" onClick={() => setTab("inventaire")}>
              <div className={`text-xl font-bold ${forecast < 0 ? "text-red-600" : "text-purple-600"}`}>
                {formatNumber(forecast)} <span className="text-sm font-normal text-gray-500">Unité</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Prévu</div>
            </div>
            {product.buy_price && (
              <div className="flex-1 px-6 py-3 text-center">
                <div className="text-base font-bold text-gray-700">
                  {formatCurrency(stockValue, product.buy_price_currency)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Valeur stock</div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex border-b border-gray-100">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-3 text-sm font-medium transition border-b-2 -mb-px ${
                  tab === t.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* GENERAL */}
            {tab === "general" && (
              <div className="grid grid-cols-2 gap-x-10 gap-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type de produit</label>
                  {editing ? (
                    <div className="flex gap-3">
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
                    <select value={form.category_id} onChange={e => setF("category_id", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                    <select value={form.unit_id} onChange={e => setF("unit_id", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— Aucune —</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-800">{product.unit?.name ?? "—"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Référence interne</label>
                  {editing ? (
                    <input value={form.reference} onChange={e => setF("reference", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="REF-001" />
                  ) : (
                    <p className="text-sm font-mono text-gray-800">{product.reference ?? "—"}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                  {editing ? (
                    <textarea value={form.description} onChange={e => setF("description", e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Description du produit…" />
                  ) : (
                    <p className="text-sm text-gray-600">{product.description ?? <span className="text-gray-300 italic">Aucune description</span>}</p>
                  )}
                </div>

                {/* Stock par entrepôt */}
                {stockLevels.length > 0 && (
                  <div className="col-span-2">
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

            {/* PRIX */}
            {tab === "prix" && (
              <div className="grid grid-cols-2 gap-x-10 gap-y-5">
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
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="18" />
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
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="18" />
                  ) : (
                    <p className="text-sm text-gray-800">{product.tva_achat ?? 18}%</p>
                  )}
                </div>

                {/* Marge */}
                {product.sell_price && product.buy_price && (
                  <div className="col-span-2 bg-blue-50 rounded-xl p-4 flex gap-8">
                    <div>
                      <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Marge brute</p>
                      <p className="text-lg font-bold text-blue-700">
                        {formatCurrency(product.sell_price - product.buy_price, product.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Taux de marge</p>
                      <p className="text-lg font-bold text-blue-700">
                        {((product.sell_price - product.buy_price) / product.buy_price * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INVENTAIRE */}
            {tab === "inventaire" && (
              <div className="grid grid-cols-2 gap-x-10 gap-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Code-barres</label>
                  {editing ? (
                    <input value={form.barcode} onChange={e => setF("barcode", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="5901234123457" />
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

                {/* Prévision */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prévision de stock</label>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Warehouse className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">{warehouses[0]?.name ?? "Entrepôt principal"}</span>
                    </div>
                    <div className="flex items-center gap-4 text-center">
                      <div className="flex-1">
                        <p className="text-2xl font-bold text-blue-600">{formatNumber(totalStock)}</p>
                        <p className="text-xs text-gray-500 mt-1">Disponible</p>
                      </div>
                      <div className="text-gray-300 text-xl font-light">+</div>
                      <div className="flex-1">
                        <p className="text-2xl font-bold text-emerald-600">{formatNumber(incoming)}</p>
                        <p className="text-xs text-gray-500 mt-1">Entrant</p>
                      </div>
                      <div className="text-gray-300 text-xl font-light">−</div>
                      <div className="flex-1">
                        <p className="text-2xl font-bold text-red-500">{formatNumber(outgoing)}</p>
                        <p className="text-xs text-gray-500 mt-1">Sortant</p>
                      </div>
                      <div className="text-gray-300 text-xl font-light">=</div>
                      <div className="flex-1">
                        <p className={`text-2xl font-bold ${forecast < 0 ? "text-red-600" : "text-purple-600"}`}>{formatNumber(forecast)}</p>
                        <p className="text-xs text-gray-500 mt-1">Prévu</p>
                      </div>
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

            {/* MOUVEMENTS */}
            {tab === "mouvements" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">{moves.length} mouvement{moves.length !== 1 ? "s" : ""}</p>
                </div>
                {moves.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Aucun mouvement enregistré</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {moves.map(m => (
                      <div key={m.id} className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          m.type === "in" ? "bg-emerald-100" : m.type === "out" ? "bg-red-100" : "bg-blue-100"
                        }`}>
                          {m.type === "in"
                            ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                            : m.type === "out"
                            ? <TrendingDown className="w-4 h-4 text-red-500" />
                            : <BarChart3 className="w-4 h-4 text-blue-500" />
                          }
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
    </div>
  )
}
