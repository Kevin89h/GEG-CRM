"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Package, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, SlidersHorizontal, Warehouse as WarehouseIcon, Plus, Download } from "lucide-react"
import { exportToXls } from "@/lib/exportXls"
import { Badge } from "@/components/ui/Badge"
import type { Warehouse } from "@/types"

interface StockLevelRow {
  id: string
  quantity: number
  product: { id: string; name: string; reference: string | null; category: { name: string; color: string } | null; unit: { name: string } | null }
  warehouse: { id: string; name: string; city: string | null }
}

interface Props {
  levels: StockLevelRow[]
  warehouses: Warehouse[]
  products: { id: string; name: string; reference: string | null; category: { name: string; color: string } | null; unit: { name: string } | null }[]
}

const categoryColors: Record<string, "blue" | "yellow" | "gray" | "green" | "purple"> = {
  blue: "blue", yellow: "yellow", gray: "gray", green: "green", purple: "purple",
}

export default function StockDashboard({ levels, warehouses, products }: Props) {
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations("stock")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [search, setSearch] = useState("")

  // Pivot: produit → { warehouseId → quantity }
  const pivot: Record<string, { product: StockLevelRow["product"]; byWarehouse: Record<string, number> }> = {}
  for (const l of levels) {
    if (!pivot[l.product.id]) {
      pivot[l.product.id] = { product: l.product, byWarehouse: {} }
    }
    pivot[l.product.id].byWarehouse[l.warehouse.id] = l.quantity
  }

  const filteredWarehouses = selectedWarehouse === "all" ? warehouses : warehouses.filter(w => w.id === selectedWarehouse)

  const rows = Object.values(pivot).filter(r => {
    const matchSearch = r.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.product.reference ?? "").toLowerCase().includes(search.toLowerCase())
    const matchWarehouse = selectedWarehouse === "all" ||
      r.byWarehouse[selectedWarehouse] !== undefined
    return matchSearch && matchWarehouse
  })

  const totalProducts = products.length
  const totalMovesToday = 0

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{totalProducts} {t("products")} · {warehouses.length} {t("sites")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/stock/entrepots`} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition">
            <WarehouseIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{t("warehouses")}</span>
          </Link>
          <Link href={`/${locale}/stock/produits`} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">{t("products")}</span>
          </Link>
          <Link href={`/${locale}/stock/mouvements`} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">{t("movements")}</span>
          </Link>
          <button
            onClick={() => {
              const xlsRows = rows.flatMap(r =>
                warehouses.map(w => ({
                  "Produit": r.product.name,
                  "Référence": r.product.reference ?? "",
                  "Catégorie": r.product.category?.name ?? "",
                  "Unité": r.product.unit?.name ?? "",
                  "Entrepôt": w.name,
                  "Quantité": r.byWarehouse[w.id] ?? 0,
                }))
              )
              exportToXls(xlsRows, "stock")
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export XLS</span>
          </button>
          <Link href={`/${locale}/stock/mouvements/nouveau`} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("movement")}</span>
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: t("stockIn"), icon: ArrowDownToLine, color: "text-emerald-600 bg-emerald-50", href: `/${locale}/stock/mouvements/nouveau?type=in` },
          { label: t("stockOut"), icon: ArrowUpFromLine, color: "text-red-600 bg-red-50", href: `/${locale}/stock/mouvements/nouveau?type=out` },
          { label: t("transfer"), icon: ArrowLeftRight, color: "text-blue-600 bg-blue-50", href: `/${locale}/stock/mouvements/nouveau?type=transfer` },
        ].map(({ label, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="font-medium text-gray-800 text-sm">{label}</span>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full sm:max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedWarehouse("all")}
            className={`px-3 py-2 text-xs rounded-lg font-medium transition ${selectedWarehouse === "all" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {t("allSites")}
          </button>
          {warehouses.map(w => (
            <button
              key={w.id}
              onClick={() => setSelectedWarehouse(w.id)}
              className={`px-3 py-2 text-xs rounded-lg font-medium transition ${selectedWarehouse === w.id ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {w.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau stock */}
      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{t("noStock")}</p>
          <p className="text-xs mt-1">{t("noStockHint")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[200px]">{t("colProduct")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("colRef")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("colUnit")}</th>
                {filteredWarehouses.map(w => (
                  <th key={w.id} className="text-right px-4 py-3 font-medium text-gray-600 min-w-[100px]">
                    {w.name}
                    {w.city && <span className="block text-xs font-normal text-gray-400">{w.city}</span>}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-medium text-gray-700 bg-blue-50/60">{t("colTotal")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(({ product, byWarehouse }) => {
                const total = filteredWarehouses.reduce((s, w) => s + (byWarehouse[w.id] ?? 0), 0)
                return (
                  <tr key={product.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {product.category && (
                          <Badge variant={categoryColors[product.category.color] ?? "gray"}>
                            {product.category.name}
                          </Badge>
                        )}
                        <span className="font-medium text-gray-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{product.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{product.unit?.name ?? "—"}</td>
                    {filteredWarehouses.map(w => {
                      const qty = byWarehouse[w.id] ?? 0
                      return (
                        <td key={w.id} className={`px-4 py-3 text-right font-medium ${qty === 0 ? "text-gray-300" : qty < 0 ? "text-red-600" : "text-gray-900"}`}>
                          {qty === 0 ? "—" : qty.toLocaleString("fr")}
                        </td>
                      )
                    })}
                    <td className={`px-4 py-3 text-right font-bold bg-blue-50/60 ${total < 0 ? "text-red-600" : "text-blue-700"}`}>
                      {total.toLocaleString("fr")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
