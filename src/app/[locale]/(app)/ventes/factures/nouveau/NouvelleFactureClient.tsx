"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, ChevronDown } from "lucide-react"
import { useTranslations } from "next-intl"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatNumber } from "@/lib/utils"
import { usePerms } from "@/components/PermissionsProvider"
import { ProductPickerDialog, productTypeLabel, type CatalogProduct } from "@/components/sales/ProductPicker"
import StockAlert from "@/components/sales/StockAlert"

interface Account { id: string; name: string }
interface Product { id: string; name: string; reference: string | null; sell_price: number; currency: string }
interface TreasuryAccount { id: string; name: string; type: string; currency: string }

interface Props {
  locale: string
  accounts: Account[]
  // Still provided by the page; lines are now chosen through the catalogue picker (server search)
  products: Product[]
  treasuryAccounts: TreasuryAccount[]
}

let _uid = 0
const uid = () => ++_uid

// R1/H1: every sales line is an active catalogue product or service, chosen through the picker.
// A comment line (line_type "comment") is text only: no product, quantity, price nor amount.
interface Line {
  id: number
  line_type: "product" | "comment"
  print_on_pdf: boolean
  print_on_delivery: boolean
  product_id: string
  product_name: string
  product_reference: string | null
  product_type: string | null
  description: string
  quantity: string
  unit_price: string
  discount: string
}

function AccountPicker({ accounts, value, onSelect, onCreated, canCreate }: {
  accounts: Account[]
  value: string
  onSelect: (id: string, name: string) => void
  onCreated: (a: Account) => void
  // Inline creation needs "comptes.creer"
  canCreate: boolean
}) {
  const t = useTranslations("factures")
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = accounts.find(a => a.id === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = accounts.filter(a => a.name.toLowerCase().includes(query.toLowerCase())).slice(0, 20)

  async function handleCreate() {
    if (!query.trim() || creating) return
    setCreating(true)
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: query.trim(), type: "client" }),
    })
    const json = await res.json()
    setCreating(false)
    if (res.ok && json.id) {
      const newAccount: Account = { id: json.id, name: json.name }
      onCreated(newAccount)
      onSelect(json.id, json.name)
      setOpen(false)
    }
  }

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
              onKeyDown={e => e.key === "Enter" && canCreate && filtered.length === 0 && handleCreate()}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map(a => (
              <div key={a.id} onMouseDown={() => { onSelect(a.id, a.name); setOpen(false) }}
                className="px-3 py-2 text-sm text-gray-800 hover:bg-blue-50 cursor-pointer">
                {a.name}
              </div>
            ))}
          </div>
          {canCreate && query.trim() && (
            <div className="border-t border-gray-100 p-1.5">
              <button
                type="button"
                onMouseDown={handleCreate}
                disabled={creating}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                {creating ? "Création…" : `Créer « ${query.trim()} »`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function NouvelleFactureClient({ locale, accounts: initialAccounts }: Props) {
  const t = useTranslations("factures")
  const router = useRouter()
  const { can } = usePerms()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [localAccounts, setLocalAccounts] = useState(initialAccounts)
  // Catalogue picker: "new" adds a line, a line id replaces the product of that line
  const [pickerTarget, setPickerTarget] = useState<"new" | number | null>(null)

  const [accountId, setAccountId] = useState("")
  const [currency, setCurrency] = useState<"GNF" | "USD" | "EUR" | "XOF">("GNF")
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<Line[]>([])

  const totals = lines.reduce((acc, l) => {
    if (l.line_type === "comment") return acc
    const qty = parseFloat(l.quantity) || 0
    const price = parseFloat(l.unit_price) || 0
    const disc = parseFloat(l.discount) || 0
    return acc + qty * price * (1 - disc / 100)
  }, 0)

  // A product chosen (or created) in the catalogue picker: adds a line or replaces the product of a line
  function onProductPicked(target: "new" | number, p: CatalogProduct) {
    const patch = {
      product_id: p.id,
      product_name: p.name,
      product_reference: p.reference,
      product_type: p.product_type,
      description: p.name,
      unit_price: String(p.sell_price ?? 0),
    }
    if (target === "new") setLines(ls => [...ls, { id: uid(), line_type: "product", print_on_pdf: true, print_on_delivery: false, quantity: "1", discount: "0", ...patch }])
    else setLines(ls => ls.map(l => l.id === target ? { ...l, ...patch } : l))
  }

  // Comment line: text only, printed on the invoice by default, not on the delivery note
  function addComment() {
    setLines(ls => [...ls, {
      id: uid(), line_type: "comment", print_on_pdf: true, print_on_delivery: false,
      product_id: "", product_name: "", product_reference: null, product_type: null,
      description: "", quantity: "0", unit_price: "0", discount: "0",
    }])
  }

  function setPrintOnPdf(id: number, value: boolean) {
    setLines(ls => ls.map(l => l.id === id ? { ...l, print_on_pdf: value } : l))
  }

  function setPrintOnDelivery(id: number, value: boolean) {
    setLines(ls => ls.map(l => l.id === id ? { ...l, print_on_delivery: value } : l))
  }

  function removeLine(id: number) {
    setLines(ls => ls.filter(l => l.id !== id))
  }

  function updateLine(id: number, field: keyof Line, val: string) {
    setLines(ls => ls.map(l => l.id === id ? { ...l, [field]: val } : l))
  }

  async function handleSave(status: "draft" | "sent") {
    if (!accountId) { setError(t("errorChooseClient")); return }
    // R1: a sales line without catalogue product cannot be submitted (the server and the database refuse it too)
    const missing = lines.map((l, i) => (l.line_type === "comment" || l.product_id ? null : i + 1)).filter((n): n is number => n !== null)
    if (missing.length) {
      setError(`Ligne${missing.length > 1 ? "s" : ""} ${missing.join(", ")} sans produit du catalogue : chaque ligne doit être un produit ou un service du catalogue GEG. Choisissez-le avec « Changer » ou supprimez la ligne.`)
      return
    }
    const emptyComments = lines.map((l, i) => (l.line_type === "comment" && !l.description.trim() ? i + 1 : null)).filter((n): n is number => n !== null)
    if (emptyComments.length) {
      setError(`Ligne${emptyComments.length > 1 ? "s" : ""} ${emptyComments.join(", ")} : le commentaire est vide. Saisissez un texte ou supprimez la ligne.`)
      return
    }
    setSaving(true); setError(null)
    const { supabase } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError(t("errorNotAuthenticated")); setSaving(false); return }

    const lineRows = lines
      .map((l, i) => l.line_type === "comment" ? {
        line_type: "comment",
        product_id: null,
        description: l.description.trim(),
        quantity: 0,
        unit_price: 0,
        discount: 0,
        position: i,
        tva_rate: 0,
        print_on_pdf: l.print_on_pdf,
        print_on_delivery: l.print_on_delivery,
      } : {
        line_type: "product",
        print_on_pdf: true,
        product_id: l.product_id,
        description: l.description.trim() || l.product_name,
        quantity: parseFloat(l.quantity) || 1,
        unit_price: parseFloat(l.unit_price) || 0,
        discount: parseFloat(l.discount) || 0,
        position: i,
        tva_rate: 0,
      })

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
          {/* Create and emit in one step: needs "factures.emettre" */}
          {can("factures.emettre") && (
            <button onClick={() => handleSave("sent")} disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50">
              {saving ? t("saving") : t("validateInvoice")}
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Formulaire */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
        {/* Client + infos */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("client")} *</label>
            <AccountPicker accounts={localAccounts} value={accountId} onSelect={(id) => setAccountId(id)} onCreated={(a) => setLocalAccounts(prev => [...prev, a])} canCreate={can("comptes.creer")} />
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
              <select value={currency} onChange={e => setCurrency(e.target.value as "GNF"|"USD"|"EUR"|"XOF")}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-400 bg-white">
                <option value="GNF">GNF — Franc guinéen</option>
                <option value="XOF">XOF — CFA (BCEAO)</option>
                <option value="USD">USD — Dollar américain</option>
                <option value="EUR">EUR — Euro</option>
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
              {lines.map(line => {
                if (line.line_type === "comment") return (
                  <tr key={line.id} className="group bg-gray-50">
                    <td colSpan={5} className="py-1.5 px-2">
                      <div className="flex items-start gap-3">
                        <span className="mt-1 shrink-0 text-[11px] px-1.5 py-0.5 rounded font-medium bg-gray-200 text-gray-600">Commentaire</span>
                        <textarea
                          value={line.description}
                          onChange={e => updateLine(line.id, "description", e.target.value)}
                          rows={1}
                          placeholder="Texte du commentaire…"
                          className="flex-1 text-sm italic text-gray-600 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-blue-400 resize-y py-0.5"
                        />
                        <div className="mt-1 shrink-0 flex flex-col gap-1">
                          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                            <input type="checkbox" checked={line.print_on_pdf} onChange={e => setPrintOnPdf(line.id, e.target.checked)} />
                            Imprimer sur la facture
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                            <input type="checkbox" checked={line.print_on_delivery} onChange={e => setPrintOnDelivery(line.id, e.target.checked)} />
                            Imprimer sur le bon de livraison
                          </label>
                        </div>
                      </div>
                    </td>
                    <td className="py-1.5 text-right">
                      <button onClick={() => removeLine(line.id)} title="Supprimer le commentaire" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity ml-2">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
                const sub = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0) * (1 - (parseFloat(line.discount) || 0) / 100)
                return (
                  <tr key={line.id} className="group">
                    <td className="py-1.5 pr-2">
                      <div className="flex items-center gap-2 flex-wrap px-2">
                        <span className="text-sm font-medium text-gray-900">{line.product_name}</span>
                        {line.product_reference && <span className="text-xs text-gray-400 font-mono">{line.product_reference}</span>}
                        <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${line.product_type === "service" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500"}`}>
                          {productTypeLabel(line.product_type)}
                        </span>
                        <button type="button" onClick={() => setPickerTarget(line.id)} className="text-xs text-gray-400 hover:text-blue-600 hover:underline">
                          Changer
                        </button>
                      </div>
                      <input
                        className="w-full text-xs px-2 py-0.5 text-gray-500 outline-none bg-transparent placeholder-gray-300 border-b border-dashed border-transparent focus:border-gray-300"
                        placeholder="Description (facultatif)"
                        value={line.description}
                        onChange={e => updateLine(line.id, "description", e.target.value)}
                      />
                    </td>
                    <td className="py-1.5 px-1">
                      <input type="number" value={line.quantity} onChange={e => updateLine(line.id, "quantity", e.target.value)}
                        className="w-full text-right text-sm px-2 py-1 outline-none bg-transparent" min="0" step="any" />
                    </td>
                    <td className="py-1.5 px-1">
                      <input type="number" value={line.unit_price} onChange={e => updateLine(line.id, "unit_price", e.target.value)}
                        className="w-full text-right text-sm px-2 py-1 outline-none bg-transparent" step="any" placeholder="0" />
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

          {/* Every sales line comes from the catalogue (R1); comments carry text only */}
          <div className="flex items-center gap-4 mt-3">
            <button onClick={() => setPickerTarget("new")} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500 font-medium">
              <Plus className="w-4 h-4" /> {t("addProduct")}
            </button>
            <button onClick={addComment} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500 font-medium">
              <Plus className="w-4 h-4" /> Ajouter un commentaire
            </button>
            <span className="text-xs text-gray-400">Chaque ligne de vente doit être un produit ou un service du catalogue. Un commentaire contient seulement du texte.</span>
          </div>

          {/* R3: non-blocking stock alerts (services and comments never checked) */}
          <StockAlert className="mt-3" lines={lines.filter(l => l.line_type !== "comment").map(l => ({ product_id: l.product_id, quantity: l.quantity }))} />
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

      {/* Catalogue picker (creation inside, gated by "produits.gerer") */}
      <ProductPickerDialog
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        locale={locale}
        currency={currency}
        onSelect={p => { if (pickerTarget !== null) onProductPicked(pickerTarget, p) }}
      />
    </div>
  )
}
