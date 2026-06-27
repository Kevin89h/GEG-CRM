"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Plus, Search, Package } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatCurrency } from "@/lib/utils"
import type { ProductCategory, Unit } from "@/types"

interface ProductRow {
  id: string
  reference: string | null
  name: string
  description: string | null
  buy_price: number | null
  buy_price_currency: "USD" | "GNF" | "EUR"
  sell_price: number | null
  currency: "USD" | "GNF" | "EUR"
  is_active: boolean
  category: { id: string; name: string; color: string } | null
  unit: { id: string; name: string; type: string } | null
}

interface Props {
  products: ProductRow[]
  categories: ProductCategory[]
  units: Unit[]
}

const colorMap: Record<string, "blue" | "yellow" | "gray" | "green" | "purple"> = {
  blue: "blue", yellow: "yellow", gray: "gray", green: "green", purple: "purple",
}

export default function ProduitsClient({ products: initial, categories, units }: Props) {
  const params = useParams()
  const locale = params.locale as string
  const [products, setProducts] = useState(initial)
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const CURRENCIES = ["GNF", "USD", "EUR"] as const
  type Currency = "USD" | "GNF" | "EUR"

  const [form, setForm] = useState({
    reference: "", name: "", description: "",
    category_id: categories[0]?.id ?? "",
    unit_id: units[0]?.id ?? "",
    buy_price: "", buy_price_currency: "GNF" as Currency,
    sell_price: "", currency: "GNF" as Currency,
  })

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.reference ?? "").toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === "all" || p.category?.id === filterCat
    return matchSearch && matchCat
  })

  async function handleSave() {
    setSaving(true)
    setSaveError("")
    const { db } = getCompanyClientBrowser()
    const { data, error } = await db
      .from("products")
      .insert([{
        name: form.name,
        reference: form.reference || null,
        description: form.description || null,
        category_id: form.category_id || null,
        unit_id: form.unit_id || null,
        buy_price: form.buy_price ? parseFloat(form.buy_price) : null,
        buy_price_currency: form.buy_price_currency,
        sell_price: form.sell_price ? parseFloat(form.sell_price) : null,
        currency: form.currency,
      }])
      .select("*, category:product_categories(id, name, color), unit:units(id, name, type)")
      .single()
    if (error) {
      setSaveError(error.message)
    } else if (data) {
      setProducts(prev => [data, ...prev])
      setModalOpen(false)
      setSaveError("")
      setForm({ reference: "", name: "", description: "", category_id: categories[0]?.id ?? "", unit_id: units[0]?.id ?? "", buy_price: "", buy_price_currency: "GNF", sell_price: "", currency: "GNF" })
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalogue produits</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} produit{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouveau produit
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCat("all")}
            className={`px-3 py-2 text-xs rounded-lg font-medium transition ${filterCat === "all" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            Tous
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterCat(c.id)}
              className={`px-3 py-2 text-xs rounded-lg font-medium transition ${filterCat === c.id ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucun produit trouvé</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Produit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Réf.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Catégorie</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Format</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Prix achat</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Prix vente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-blue-50/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link href={`/${locale}/stock/produits/${p.id}`} className="hover:text-blue-600 transition-colors">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3">
                    {p.category ? (
                      <Badge variant={colorMap[p.category.color] ?? "gray"}>{p.category.name}</Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.unit?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {p.buy_price != null ? formatCurrency(p.buy_price, p.buy_price_currency ?? p.currency) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {p.sell_price != null ? formatCurrency(p.sell_price, p.currency) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nouveau produit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau produit">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="col-span-1 sm:col-span-2">
              <Input label="Nom du produit" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <Input label="Référence" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="LUB-20L-001" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Catégorie"
              value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              options={categories.map(c => ({ value: c.id, label: c.name }))}
            />
            <Select
              label="Format / Conditionnement"
              value={form.unit_id}
              onChange={e => setForm(f => ({ ...f, unit_id: e.target.value }))}
              options={units.map(u => ({ value: u.id, label: u.name }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label="Prix achat"
                  type="number"
                  value={form.buy_price}
                  onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))}
                />
              </div>
              <Select
                label="Devise achat"
                value={form.buy_price_currency}
                onChange={e => setForm(f => ({ ...f, buy_price_currency: e.target.value as Currency }))}
                options={CURRENCIES.map(c => ({ value: c, label: c }))}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label="Prix vente"
                  type="number"
                  value={form.sell_price}
                  onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))}
                />
              </div>
              <Select
                label="Devise vente"
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value as Currency }))}
                options={CURRENCIES.map(c => ({ value: c, label: c }))}
              />
            </div>
          </div>

          {saveError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.name || saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
