"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, ChevronDown } from "lucide-react"
import { useTranslations } from "next-intl"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatNumber } from "@/lib/utils"

interface Account { id: string; name: string }
interface Product { id: string; name: string; reference: string | null; sell_price: number; currency: string }
interface TreasuryAccount { id: string; name: string; type: string; currency: string }

interface Props {
  locale: string
  accounts: Account[]
  products: Product[]
  treasuryAccounts: TreasuryAccount[]
}

let _uid = 0
const uid = () => ++_uid

interface Line {
  id: number
  kind: "product" | "note"
  product_id: string
  description: string
  quantity: string
  unit_price: string
  discount: string
}

function AccountPicker({ accounts, value, onSelect }: {
  accounts: Account[]
  value: string
  onSelect: (id: string, name: string) => void
}) {
  const t = useTranslations("factures")
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = accounts.find(a => a.id === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = accounts.filter(a => a.name.toLowerCase().includes(query.toLowerCase())).slice(0, 20)

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => { setOpen(o => !o); setQuery("") }}
        className="flex items-center gap-2 min-w-[260px] cursor-pointer border border-gray-200 rounded-lg px-3 py-2 bg-white hover:border-gray-300 transition-colors"
      >
        <span className={`flex-1 text-sm ${selected ? "text-gray-900 font-medium" : "text-gray-400"}`}>
          {selected ? selected.name : t("chooseClient")}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-80 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-blue-400"
              placeholder={t("search")}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && <p className="text-sm text-gray-400 px-3 py-2">{t("noResults")}</p>}
            {filtered.map(a => (
              <div key={a.id} onMouseDown={() => { onSelect(a.id, a.name); setOpen(false) }}
                className="px-3 py-2 text-sm text-gray-800 hover:bg-blue-50 cursor-pointer">
                {a.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProductPicker({ products, value, onChange, lineIndex }: {
  products: Product[]
  value: string
  onChange: (lineIndex: number, product: Product | null, raw: string) => void
  lineIndex: number
}) {
  const t = useTranslations("factures")
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = products.find(p => p.id === value)

  useEffect(() => {
    if (selected) setQuery(selected.name)
  }, [selected])

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    (p.reference ?? "").toLowerCase().includes(query.toLowerCase())
  ).slice(0, 20)

  return (
    <div ref={ref} className="relative">
      <input
        className="w-full text-sm px-2 py-1 outline-none bg-transparent placeholder-gray-300"
        placeholder={t("searchProduct")}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); setOpen(true); onChange(lineIndex, null, e.target.value) }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-0.5 left-0 w-72 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(p => (
              <div key={p.id} onMouseDown={() => { onChange(lineIndex, p, p.name); setQuery(p.name); setOpen(false) }}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer">
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                {p.reference && <p className="text-xs text-gray-400 font-mono">{p.reference}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NouvelleFactureClient({ locale, accounts, products, treasuryAccounts }: Props) {
  const t = useTranslations("factures")
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [accountId, setAccountId] = useState("")
  const [currency, setCurrency] = useState<"GNF" | "USD" | "EUR">("GNF")
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<Line[]>([])

  const totals = lines.reduce((acc, l) => {
    if (l.kind !== "product") return acc
    const qty = parseFloat(l.quantity) || 0
    const price = parseFloat(l.unit_price) || 0
    const disc = parseFloat(l.discount) || 0
    return acc + qty * price * (1 - disc / 100)
  }, 0)

  function addProductLine() {
    setLines(ls => [...ls, { id: uid(), kind: "product", product_id: "", description: "", quantity: "1", unit_price: "", discount: "0" }])
  }

  function addNoteLine() {
    setLines(ls => [...ls, { id: uid(), kind: "note", product_id: "", description: "", quantity: "", unit_price: "", discount: "" }])
  }

  function removeLine(id: number) {
    setLines(ls => ls.filter(l => l.id !== id))
  }

  function updateLine(id: number, field: keyof Line, val: string) {
    setLines(ls => ls.map(l => l.id === id ? { ...l, [field]: val } : l))
  }

  function handleProductSelect(lineIndex: number, product: Product | null, raw: string) {
    setLines(ls => ls.map((l, i) => {
      if (i !== lineIndex) return l
      if (!product) return { ...l, description: raw, product_id: "" }
      return { ...l, product_id: product.id, description: product.name, unit_price: String(product.sell_price) }
    }))
  }

  async function handleSave(status: "draft" | "sent") {
    if (!accountId) { setError(t("errorChooseClient")); return }
    setSaving(true); setError(null)
    const { supabase } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError(t("errorNotAuthenticated")); setSaving(false); return }

    const lineRows = lines
      .filter(l => l.kind === "note" ? l.description.trim() : l.description.trim() || l.product_id)
      .map((l, i) => ({
        product_id: l.product_id || null,
        description: l.description || "",
        quantity: l.kind === "note" ? 0 : parseFloat(l.quantity) || 1,
        unit_price: l.kind === "note" ? 0 : parseFloat(l.unit_price) || 0,
        discount: parseFloat(l.discount) || 0,
        position: i,
        tva_rate: 0,
      }))

    const res = await fetch("/api/factures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice: {
          account_id: accountId,
          currency,
          status,
          issue_date: issueDate,
          due_date: dueDate || null,
          notes: notes || null,
        },
        lines: lineRows,
        user_id: user.id,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? t("errorGeneric")); setSaving(false); return }

    router.push(`/${locale}/ventes/factures/${json.id}`)
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("newInvoice")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("clientInvoice")}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.back()} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
            {t("cancel")}
          </button>
          <button onClick={() => handleSave("draft")} disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50">
            {t("saveDraft")}
          </button>
          <button onClick={() => handleSave("sent")} disabled={saving}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50">
            {saving ? t("saving") : t("validateInvoice")}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Formulaire */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
        {/* Client + infos */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("client")} *</label>
            <AccountPicker accounts={accounts} value={accountId} onSelect={(id) => setAccountId(id)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("date")}</label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("dueDate")}</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("currency")}</label>
              <select value={currency} onChange={e => setCurrency(e.target.value as "GNF"|"USD"|"EUR")}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-400 bg-white">
                <option value="GNF">GNF</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lignes */}
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-[40%]">{t("colProductDescription")}</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-20">{t("colQty")}</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">{t("colUnitPrice")}</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-20">{t("colDiscount")}</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">{t("colSubtotal")}</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map((line, idx) => {
                if (line.kind === "note") return (
                  <tr key={line.id} className="group">
                    <td colSpan={5} className="py-2">
                      <input
                        className="w-full text-sm px-2 py-1 italic text-gray-500 outline-none bg-transparent placeholder-gray-300"
                        placeholder={t("notePlaceholder")}
                        value={line.description}
                        onChange={e => updateLine(line.id, "description", e.target.value)}
                      />
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => removeLine(line.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )

                const sub = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0) * (1 - (parseFloat(line.discount) || 0) / 100)
                return (
                  <tr key={line.id} className="group">
                    <td className="py-1.5 pr-2">
                      <ProductPicker products={products} value={line.product_id} onChange={handleProductSelect} lineIndex={idx} />
                    </td>
                    <td className="py-1.5 px-1">
                      <input type="number" value={line.quantity} onChange={e => updateLine(line.id, "quantity", e.target.value)}
                        className="w-full text-right text-sm px-2 py-1 outline-none bg-transparent" min="0" step="any" />
                    </td>
                    <td className="py-1.5 px-1">
                      <input type="number" value={line.unit_price} onChange={e => updateLine(line.id, "unit_price", e.target.value)}
                        className="w-full text-right text-sm px-2 py-1 outline-none bg-transparent" min="0" step="any" placeholder="0" />
                    </td>
                    <td className="py-1.5 px-1">
                      <input type="number" value={line.discount} onChange={e => updateLine(line.id, "discount", e.target.value)}
                        className="w-full text-right text-sm px-2 py-1 outline-none bg-transparent" min="0" max="100" step="any" />
                    </td>
                    <td className="py-1.5 pl-2 text-right text-sm font-medium text-gray-900">
                      {formatNumber(sub)}
                    </td>
                    <td className="py-1.5 text-right">
                      <button onClick={() => removeLine(line.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity ml-2">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="flex gap-4 mt-3">
            <button onClick={addProductLine} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500 font-medium">
              <Plus className="w-4 h-4" /> {t("addProduct")}
            </button>
            <button onClick={addNoteLine} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600">
              <Plus className="w-4 h-4" /> {t("addNote")}
            </button>
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-end pt-2 border-t border-gray-100">
          <div className="text-right space-y-1">
            <div className="flex justify-between gap-16 text-sm text-gray-500">
              <span>{t("totalHT")}</span>
              <span className="font-medium text-gray-900">{formatNumber(totals)} {currency}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("internalNotes")}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-blue-400 resize-none"
            placeholder={t("notesPlaceholder")} />
        </div>
      </div>
    </div>
  )
}
