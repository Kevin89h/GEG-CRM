"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, ArrowLeft, Info } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"

interface Product { id: string; name: string; reference: string | null; buy_price: number | null }
interface Props { products: Product[]; locale: string }

interface Line {
  product_id: string
  description: string
  quantity: string
  unit_price: string
}

export default function NouvelAchatClient({ products, locale }: Props) {
  const t = useTranslations("achats")
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    supplier_name: "",
    currency: "GNF" as "USD" | "GNF" | "EUR",
    incoterm: "CIF",
    order_date: new Date().toISOString().split("T")[0],
    expected_date: "",
    notes: "",
    freight_cost: "",
    insurance_cost: "",
    global_discount_pct: "",
  })
  const [lines, setLines] = useState<Line[]>([
    { product_id: "", description: "", quantity: "1", unit_price: "0" },
  ])

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

  function setLine(i: number, k: keyof Line, v: string) {
    setLines(ls => ls.map((l, idx) => {
      if (idx !== i) return l
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
    const { supabase, db } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError(t("errorNotAuthenticated")); setSaving(false); return }

    // Générer un numéro unique basé sur timestamp pour éviter les doublons
    const { count } = await db
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
    const num = `PO-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}-${Date.now().toString().slice(-4)}`

    const { data: order, error: err } = await db
      .from("purchase_orders")
      .insert([{
        number: num,
        supplier_name: form.supplier_name,
        currency: form.currency,
        incoterm: form.incoterm,
        order_date: form.order_date,
        expected_date: form.expected_date || null,
        notes: form.notes || null,
        user_id: user.id,
        freight_cost: freight,
        insurance_cost: insurance,
        global_discount_pct: discountPct,
      }])
      .select("id")
      .single()

    if (err || !order) { setError(err?.message ?? t("errorGeneric")); setSaving(false); return }

    await db.from("purchase_order_lines").insert(
      lines.map((l, i) => ({
        order_id: order.id,
        product_id: l.product_id || null,
        description: l.description,
        quantity: parseFloat(l.quantity) || 1,
        fob_unit_price: parseFloat(l.unit_price) || 0,
        position: i,
      }))
    )

    // Créer automatiquement les purchase_costs pour fret et assurance
    const costsToCreate = []
    if (freight > 0) costsToCreate.push({ order_id: order.id, type: "transport_maritime", label: t("labelSeaFreight"), amount: freight, currency: form.currency })
    if (insurance > 0) costsToCreate.push({ order_id: order.id, type: "assurance", label: t("labelSeaInsurance"), amount: insurance, currency: form.currency })
    if (costsToCreate.length > 0) {
      await db.from("purchase_costs").insert(costsToCreate)
    }

    router.push(`/${locale}/achats/${order.id}`)
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
            <Input label={t("labelSupplierName")} value={form.supplier_name}
              onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
              placeholder="TotalEnergies, YESIL, Bridgestone…" />
            <Select label={t("labelCurrency")} value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value as "USD" | "GNF" | "EUR" }))}
              options={[{ value: "GNF", label: t("currencyGNF") }, { value: "USD", label: t("currencyUSD") }, { value: "EUR", label: t("currencyEUR") }]} />
            <Input label={t("labelOrderDate")} type="date" value={form.order_date}
              onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} />
            <Input label={t("labelExpectedDate")} type="date" value={form.expected_date}
              onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />

            {/* Incoterm — prend toute la largeur */}
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
          <h2 className="font-semibold text-gray-800 mb-4">{t("sectionProducts")}</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 px-1">
              <div className="col-span-4">{t("colProduct")}</div>
              <div className="col-span-4">{t("colDescription")}</div>
              <div className="col-span-2 text-right">{t("colQuantity")}</div>
              <div className="col-span-2 text-right">{t("colUnitPrice")} ({form.incoterm})</div>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <select value={l.product_id} onChange={e => setLine(i, "product_id", e.target.value)}
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
                  <input value={l.description} onChange={e => setLine(i, "description", e.target.value)}
                    placeholder={t("placeholderDescription")}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <input type="number" min="0" step="any" value={l.quantity}
                    onChange={e => setLine(i, "quantity", e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
                </div>
                <div className="col-span-1">
                  <input type="number" min="0" step="any" value={l.unit_price}
                    onChange={e => setLine(i, "unit_price", e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
                </div>
                <div className="col-span-1 flex justify-end">
                  {lines.length > 1 && (
                    <button onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))}
                      className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setLines(ls => [...ls, { product_id: "", description: "", quantity: "1", unit_price: "0" }])}
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
    </div>
  )
}
