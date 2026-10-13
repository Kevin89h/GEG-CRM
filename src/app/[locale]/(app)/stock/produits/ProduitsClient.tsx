"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus, Search, Package, Download, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { formatCurrency } from "@/lib/utils"
import { exportToXls } from "@/lib/exportXls"
import type { ProductCategory, Unit } from "@/types"

interface PackagingRow {
  id: string
  unit_id: string
  sell_price: number | null
  buy_price: number | null
  currency: string
  buy_price_currency: string
}

interface ProductRow {
  id: string
  product_code: string | null
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
  unit_ids: string[] | null
  packaging: PackagingRow[] | null
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
  const t = useTranslations("produits")
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

  const [localUnits, setLocalUnits] = useState(units)
  interface PkgFormRow { unit_id: string; sell_price: string; buy_price: string; sell_currency: Currency; buy_currency: Currency }

  const [form, setForm] = useState({
    reference: "", name: "", description: "",
    category_id: categories[0]?.id ?? "",
    sell_price: "", currency: "GNF" as Currency,
    buy_price: "", buy_price_currency: "GNF" as Currency,
  })
  const [pkgRows, setPkgRows] = useState<PkgFormRow[]>([])
  const [showNewFormat, setShowNewFormat] = useState(false)
  const [newFormatName, setNewFormatName] = useState("")
  const [newFormatSaving, setNewFormatSaving] = useState(false)

  function addPkgRow() {
    setPkgRows(r => [...r, { unit_id: localUnits[0]?.id ?? "", sell_price: "", buy_price: "", sell_currency: form.currency, buy_currency: form.buy_price_currency }])
  }
  function updatePkgRow(i: number, patch: Partial<PkgFormRow>) {
    setPkgRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }
  function removePkgRow(i: number) {
    setPkgRows(r => r.filter((_, idx) => idx !== i))
  }

  async function handleCreateFormat() {
    if (!newFormatName.trim()) return
    setNewFormatSaving(true)
    const res = await fetch("/api/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFormatName.trim(), type: "unit" }),
    })
    const json = await res.json()
    if (res.ok && json.unit) {
      setLocalUnits(prev => [...prev, json.unit])
      setPkgRows(r => [...r, { unit_id: json.unit.id, sell_price: "", buy_price: "", sell_currency: form.currency, buy_currency: form.buy_price_currency }])
      setShowNewFormat(false)
      setNewFormatName("")
    }
    setNewFormatSaving(false)
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.reference ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.product_code ?? "").toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === "all" || p.category?.id === filterCat
    return matchSearch && matchCat
  })

  async function handleSave() {
    setSaving(true)
    setSaveError("")
    // Derive unit_ids from packaging rows for backwards compat
    const validPkg = pkgRows.filter(r => r.unit_id)
    const unit_ids = validPkg.length > 0 ? validPkg.map(r => r.unit_id) : null
    const res = await fetch("/api/stock/produits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        reference: form.reference || null,
        description: form.description || null,
        category_id: form.category_id || null,
        unit_ids,
        buy_price: form.buy_price ? parseFloat(form.buy_price) : null,
        buy_price_currency: form.buy_price_currency,
        sell_price: form.sell_price ? parseFloat(form.sell_price) : null,
        currency: form.currency,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setSaveError(json.error ?? "Erreur serveur")
      setSaving(false)
      return
    }
    // Save packaging rows if any
    if (validPkg.length > 0) {
      await fetch(`/api/stock/produits/${json.id}/packaging`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packaging: validPkg.map(r => ({
            unit_id: r.unit_id,
            sell_price: r.sell_price ? parseFloat(r.sell_price) : null,
            buy_price: r.buy_price ? parseFloat(r.buy_price) : null,
            currency: r.sell_currency,
            buy_price_currency: r.buy_currency,
          }))
        }),
      })
    }
    setProducts(prev => [{ ...json, packaging: validPkg.length > 0 ? validPkg : null }, ...prev])
    setModalOpen(false)
    setSaveError("")
    setShowNewFormat(false)
    setNewFormatName("")
    setPkgRows([])
    setForm({ reference: "", name: "", description: "", category_id: categories[0]?.id ?? "", sell_price: "", currency: "GNF", buy_price: "", buy_price_currency: "GNF" })
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("catalogueProduits")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} {t("produit")}{filtered.length !== 1 ? t("pluralSuffix") : ""}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportToXls(filtered.map(p => ({
              "Code": p.product_code ?? "",
              "Référence": p.reference ?? "",
              "Nom": p.name,
              "Catégorie": p.category?.name ?? "",
              "Unité": p.unit?.name ?? "",
              "Prix achat": p.buy_price ?? "",
              "Devise achat": p.buy_price_currency,
              "Prix vente": p.sell_price ?? "",
              "Devise vente": p.currency,
              "Actif": p.is_active ? "Oui" : "Non",
            })), "produits")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >
            <Download className="w-4 h-4" /> Export XLS
          </button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            {t("nouveauProduit")}
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("rechercher")}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCat("all")}
            className={`px-3 py-2 text-xs rounded-lg font-medium transition ${filterCat === "all" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {t("tous")}
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
          <p>{t("aucunProduitTrouve")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("colProduit")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("colReference")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("colCategorie")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("colFormat")}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colPrixAchat")}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colPrixVente")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-blue-50/30 transition-colors cursor-pointer" onClick={() => window.location.href = `/${locale}/stock/produits/${p.id}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-blue-700 font-mono text-xs font-semibold">{p.product_code ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3">
                    {p.category ? (
                      <Badge variant={colorMap[p.category.color] ?? "gray"}>{p.category.name}</Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {(p.unit_ids && p.unit_ids.length > 0)
                      ? <div className="flex flex-wrap gap-1">
                          {p.unit_ids.map(uid => {
                            const u = localUnits.find(u => u.id === uid)
                            return u ? (
                              <span key={uid} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{u.name}</span>
                            ) : null
                          })}
                        </div>
                      : p.unit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{p.unit.name}</span>
                        ) : "—"
                    }
                  </td>
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("nouveauProduit")}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="col-span-1 sm:col-span-2">
              <Input label={t("nomDuProduit")} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <Input label={`${t("reference")} (optionnel)`} value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="ex: CIM-42.5-001" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={t("categorie")}
              value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              options={categories.map(c => ({ value: c.id, label: c.name }))}
            />
          </div>

          <div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Formats / Conditionnements</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewFormat(v => !v)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <span className="text-base font-bold leading-none">+</span> Créer format
                  </button>
                  <button
                    type="button"
                    onClick={addPkgRow}
                    className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium"
                  >
                    <span className="text-base font-bold leading-none">+</span> Ajouter ligne
                  </button>
                </div>
              </div>

              {showNewFormat && (
                <div className="mb-2 flex gap-2 items-center p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <input
                    autoFocus
                    value={newFormatName}
                    onChange={e => setNewFormatName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleCreateFormat()}
                    placeholder="Ex: Bidon 20L, Carton 12 pcs…"
                    className="flex-1 px-2 py-1.5 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleCreateFormat}
                    disabled={!newFormatName.trim() || newFormatSaving}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {newFormatSaving ? "…" : "Créer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewFormat(false); setNewFormatName("") }}
                    className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition"
                  >
                    ✕
                  </button>
                </div>
              )}

              {pkgRows.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">Aucun format — les prix globaux ci-dessous s&apos;appliqueront.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-2 py-1.5 font-medium text-gray-600">Format</th>
                        <th className="text-left px-2 py-1.5 font-medium text-gray-600">Prix achat</th>
                        <th className="text-left px-2 py-1.5 font-medium text-gray-600">Devise</th>
                        <th className="text-left px-2 py-1.5 font-medium text-gray-600">Prix vente</th>
                        <th className="text-left px-2 py-1.5 font-medium text-gray-600">Devise</th>
                        <th className="px-2 py-1.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pkgRows.map((row, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5">
                            <select
                              value={row.unit_id}
                              onChange={e => updatePkgRow(i, { unit_id: e.target.value })}
                              className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {localUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              value={row.buy_price}
                              onChange={e => updatePkgRow(i, { buy_price: e.target.value })}
                              placeholder="0"
                              className="w-20 text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={row.buy_currency}
                              onChange={e => updatePkgRow(i, { buy_currency: e.target.value as Currency })}
                              className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              value={row.sell_price}
                              onChange={e => updatePkgRow(i, { sell_price: e.target.value })}
                              placeholder="0"
                              className="w-20 text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={row.sell_currency}
                              onChange={e => updatePkgRow(i, { sell_currency: e.target.value as Currency })}
                              className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <button type="button" onClick={() => removePkgRow(i)} className="text-red-400 hover:text-red-600 transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("description")}</label>
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
                  label={t("prixAchat")}
                  type="number"
                  value={form.buy_price}
                  onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))}
                />
              </div>
              <Select
                label={t("deviseAchat")}
                value={form.buy_price_currency}
                onChange={e => setForm(f => ({ ...f, buy_price_currency: e.target.value as Currency }))}
                options={CURRENCIES.map(c => ({ value: c, label: c }))}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label={t("prixVente")}
                  type="number"
                  value={form.sell_price}
                  onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))}
                />
              </div>
              <Select
                label={t("deviseVente")}
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
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("annuler")}</Button>
            <Button onClick={handleSave} disabled={!form.name || saving}>
              {saving ? t("enregistrement") : t("enregistrer")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
