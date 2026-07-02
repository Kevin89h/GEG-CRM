"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, SlidersHorizontal, AlertTriangle, Skull, Trash2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import type { Warehouse } from "@/types"

interface ProductOption {
  id: string
  name: string
  reference: string | null
  unit: { name: string } | null
}

interface StockLevel {
  product_id: string
  warehouse_id: string
  quantity: number
}

interface Props {
  warehouses: Warehouse[]
  products: ProductOption[]
  stockLevels: StockLevel[]
  initialType?: string
  initialProductId?: string
  locale: string
}

type MoveType = "in" | "out" | "transfer" | "adjustment" | "damaged" | "lost" | "destroyed"

const VALID_TYPES: MoveType[] = ["in", "out", "transfer", "adjustment", "damaged", "lost", "destroyed"]

export default function NouveauMouvementClient({ warehouses, products, stockLevels, initialType, initialProductId, locale }: Props) {
  const router = useRouter()
  const t = useTranslations("mouvements")

  const typeConfig: Record<MoveType, { label: string; icon: React.ElementType; color: string; description: string; needsFrom: boolean; needsTo: boolean }> = {
    in: {
      label: t("typeInLabel"), icon: ArrowDownToLine,
      color: "border-emerald-500 bg-emerald-50 text-emerald-700",
      description: t("typeInDescription"),
      needsFrom: false, needsTo: true,
    },
    out: {
      label: t("typeOutLabel"), icon: ArrowUpFromLine,
      color: "border-red-400 bg-red-50 text-red-700",
      description: t("typeOutDescription"),
      needsFrom: true, needsTo: false,
    },
    transfer: {
      label: t("typeTransferLabel"), icon: ArrowLeftRight,
      color: "border-blue-500 bg-blue-50 text-blue-700",
      description: t("typeTransferDescription"),
      needsFrom: true, needsTo: true,
    },
    adjustment: {
      label: t("typeAdjustmentLabel"), icon: SlidersHorizontal,
      color: "border-amber-400 bg-amber-50 text-amber-700",
      description: t("typeAdjustmentDescription"),
      needsFrom: false, needsTo: true,
    },
    damaged: {
      label: t("typeDamagedLabel"), icon: AlertTriangle,
      color: "border-yellow-500 bg-yellow-50 text-yellow-700",
      description: t("typeDamagedDescription"),
      needsFrom: true, needsTo: false,
    },
    lost: {
      label: t("typeLostLabel"), icon: Skull,
      color: "border-red-500 bg-red-50 text-red-700",
      description: t("typeLostDescription"),
      needsFrom: true, needsTo: false,
    },
    destroyed: {
      label: t("typeDestroyedLabel"), icon: Trash2,
      color: "border-gray-500 bg-gray-50 text-gray-700",
      description: t("typeDestroyedDescription"),
      needsFrom: true, needsTo: false,
    },
  }

  const [type, setType] = useState<MoveType>(
    (VALID_TYPES.includes(initialType as MoveType) ? initialType : "in") as MoveType
  )
  const [form, setForm] = useState({
    product_id: initialProductId ?? products[0]?.id ?? "",
    from_warehouse_id: "",
    to_warehouse_id: warehouses[0]?.id ?? "",
    quantity: "",
    note: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cfg = typeConfig[type]
  const selectedProduct = products.find(p => p.id === form.product_id)

  function getStockForProduct(productId: string): { warehouseId: string; warehouseName: string; quantity: number }[] {
    return stockLevels
      .filter(s => s.product_id === productId && s.quantity > 0)
      .map(s => ({
        warehouseId: s.warehouse_id,
        warehouseName: warehouses.find(w => w.id === s.warehouse_id)?.name ?? s.warehouse_id,
        quantity: s.quantity,
      }))
      .sort((a, b) => b.quantity - a.quantity)
  }

  const productStockLines = form.product_id ? getStockForProduct(form.product_id) : []
  const totalStock = productStockLines.reduce((s, l) => s + l.quantity, 0)

  function set(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.product_id || !form.quantity) return
    if (cfg.needsFrom && !form.from_warehouse_id) return
    if (cfg.needsTo && !form.to_warehouse_id) return

    const qty = parseFloat(form.quantity)
    if (isNaN(qty) || qty <= 0) {
      setError("La quantité doit être supérieure à 0")
      return
    }

    setSaving(true)
    setError(null)

    const { supabase, db } = getCompanyClientBrowser()
    const payload: Record<string, unknown> = {
      type,
      product_id: form.product_id,
      quantity: qty,
      notes: form.note || null,
      from_warehouse_id: cfg.needsFrom ? form.from_warehouse_id : null,
      to_warehouse_id: cfg.needsTo ? form.to_warehouse_id : null,
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError(t("errorNotAuthenticated")); setSaving(false); return }
    payload.user_id = user.id

    const { error: err } = await db.from("stock_moves").insert([payload])
    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    router.push(`/${locale}/stock`)
    router.refresh()
  }

  const isValid = form.product_id && form.quantity &&
    (!cfg.needsFrom || form.from_warehouse_id) &&
    (!cfg.needsTo || form.to_warehouse_id) &&
    (type !== "transfer" || form.from_warehouse_id !== form.to_warehouse_id)

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/${locale}/stock`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("backToStock")}
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("pageTitle")}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{t("pageSubtitle")}</p>
      </div>

      {/* Type selector — 2 columns grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {VALID_TYPES.map(key => {
          const c = typeConfig[key]
          const Icon = c.icon
          const active = type === key
          return (
            <button
              key={key}
              onClick={() => {
                setType(key)
                // Reset warehouse fields when switching needsFrom/needsTo
                setForm(f => ({
                  ...f,
                  from_warehouse_id: "",
                  to_warehouse_id: typeConfig[key].needsTo ? (warehouses[0]?.id ?? "") : "",
                }))
              }}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 transition text-left ${
                active ? c.color : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">{c.label}</p>
                <p className="text-xs mt-0.5 opacity-70">{c.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <Select
          label={t("labelProduct")}
          value={form.product_id}
          onChange={e => set("product_id", e.target.value)}
          options={products.map(p => ({
            value: p.id,
            label: p.reference ? `${p.name} (${p.reference})` : p.name,
          }))}
        />

        {form.product_id && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-700">Stock actuel</span>
              <span className={`font-bold ${totalStock === 0 ? "text-red-600" : "text-gray-900"}`}>
                {totalStock.toLocaleString("fr")} {selectedProduct?.unit?.name ?? ""}
              </span>
            </div>
            {productStockLines.length === 0 ? (
              <p className="text-xs text-red-500">Aucun stock disponible</p>
            ) : (
              <div className="space-y-0.5 mt-1">
                {productStockLines.map(l => (
                  <div key={l.warehouseId} className="flex justify-between text-xs text-gray-500">
                    <span>{l.warehouseName}</span>
                    <span className="font-medium text-gray-700">{l.quantity.toLocaleString("fr")} {selectedProduct?.unit?.name ?? ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Input
          label={`${t("labelQuantity")}${selectedProduct?.unit ? ` (${selectedProduct.unit.name})` : ""}`}
          type="number"
          min="0.001"
          step="any"
          value={form.quantity}
          onChange={e => set("quantity", e.target.value)}
          placeholder="0"
        />

        {cfg.needsFrom && (
          <Select
            label={type === "transfer" ? t("labelSiteSource") : t("labelStorageSite")}
            value={form.from_warehouse_id}
            onChange={e => set("from_warehouse_id", e.target.value)}
            options={[
              { value: "", label: t("chooseSite") },
              ...warehouses.map(w => ({ value: w.id, label: w.city ? `${w.name} — ${w.city}` : w.name })),
            ]}
          />
        )}

        {cfg.needsTo && (
          <Select
            label={type === "transfer" ? t("labelSiteDestination") : t("labelStorageSite")}
            value={form.to_warehouse_id}
            onChange={e => set("to_warehouse_id", e.target.value)}
            options={[
              { value: "", label: t("chooseSite") },
              ...warehouses.map(w => ({ value: w.id, label: w.city ? `${w.name} — ${w.city}` : w.name })),
            ]}
          />
        )}

        {type === "transfer" && form.from_warehouse_id && form.to_warehouse_id && form.from_warehouse_id === form.to_warehouse_id && (
          <p className="text-xs text-red-600">{t("errorSameWarehouse")}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("labelNote")}</label>
          <textarea
            value={form.note}
            onChange={e => set("note", e.target.value)}
            rows={2}
            placeholder={
              type === "damaged" ? t("placeholderDamaged") :
              type === "lost" ? t("placeholderLost") :
              type === "destroyed" ? t("placeholderDestroyed") :
              t("placeholderDefault")
            }
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => router.back()}>{t("cancel")}</Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  )
}
