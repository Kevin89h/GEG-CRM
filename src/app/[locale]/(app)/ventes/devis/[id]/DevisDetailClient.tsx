"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircle, Receipt, X, Printer, ArrowLeft, RotateCcw, Truck, Plus, Trash2, Copy } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatDate, formatNumber } from "@/lib/utils"
import DocumentLayout from "@/components/print/DocumentLayout"
import ActivityLog from "@/components/ActivityLog"
import ShareButton from "@/components/ShareButton"
import { PROJECT_OPTIONS } from "@/lib/projects"
import { usePerms } from "@/components/PermissionsProvider"
import { ProductPickerDialog, type CatalogProduct } from "@/components/sales/ProductPicker"
import StockAlert, { type Availability } from "@/components/sales/StockAlert"

interface Line {
  id: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  tva_exempt?: boolean | null
  product_id?: string | null
  product: { name: string; reference: string | null } | null
  unit?: { name: string } | null
  // "comment": text only (no product, quantity, price nor amount); "product" (default): sales line
  line_type?: string | null
  print_on_pdf?: boolean | null
  // Comment only: printed on delivery notes made from this quote (default false)
  print_on_delivery?: boolean | null
}

const isComment = (l: { line_type?: string | null }) => l.line_type === "comment"

interface Order {
  id: string
  number: string
  status: string
  currency: string
  valid_until: string | null
  notes: string | null
  additional_info: string | null
  created_at: string
  date_order?: string | null
  payment_terms?: string | null
  client_order_ref?: string | null
  tva?: boolean | null
  title?: string | null
  project_code?: string | null
  commission_client?: number | null
  conditions_generales?: string | null
  account: { id: string; name: string; country: string | null } | null
  contact: { id: string; first_name: string; last_name: string } | null
  salesperson?: { full_name: string } | null
  lines: Line[]
}

interface ProductOption {
  id: string
  name: string
  reference: string | null
  sale_price: number | null
  image_url: string | null
  unit: { name: string } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { order: Order; locale: string; docSettings?: Record<string, any>; stockByProduct: Record<string, number>; firstWarehouse: { id: string; name: string } | null; invoiceCount?: number; firstInvoiceId?: string | null; deliveryCount?: number; allProducts?: ProductOption[] }

function getStepIndex(status: string) {
  if (status === "draft") return 0
  if (status === "confirmed") return 2
  if (status === "invoiced") return 3
  return -1 // cancelled
}

export default function DevisDetailClient({ order, locale, docSettings = {}, stockByProduct, firstWarehouse, invoiceCount = 0, firstInvoiceId = null, deliveryCount = 0, allProducts = [] }: Props) {
  const t = useTranslations("devis")
  const router = useRouter()
  const { can } = usePerms()
  const [loading, setLoading] = useState(false)
  const [addingLine, setAddingLine] = useState(false)
  // Catalogue picker: "new" adds a line, a line id attaches that free line to a product (R1)
  const [pickerTarget, setPickerTarget] = useState<"new" | string | null>(null)
  // Comment being typed before it is added (null: no comment form open)
  const [newComment, setNewComment] = useState<string | null>(null)
  const [newCommentPrint, setNewCommentPrint] = useState(true)
  const [newCommentPrintDelivery, setNewCommentPrintDelivery] = useState(false)
  // Stock per product from /api/stock/disponibilite (used to recognise services, never stock-checked)
  const [availability, setAvailability] = useState<Record<string, Availability>>({})
  const [activeTab, setActiveTab] = useState<"lines" | "other" | "notes">("lines")
  const [tva, setTva] = useState<boolean>(order.tva ?? false)
  const [lines, setLines] = useState<Line[]>(order.lines)
  const [orderFields, setOrderFields] = useState({
    payment_terms: order.payment_terms ?? "",
    valid_until: order.valid_until ?? "",
    client_order_ref: order.client_order_ref ?? "",
    currency: order.currency ?? "GNF",
    project_code: order.project_code ?? "",
    date_order: order.date_order ?? order.created_at.slice(0, 10),
  })
  const [notes, setNotes] = useState(order.notes ?? "")
  const [notesSaving, setNotesSaving] = useState(false)
  const [additionalInfo, setAdditionalInfo] = useState(order.additional_info ?? "")
  const [additionalInfoSaving, setAdditionalInfoSaving] = useState(false)
  const [editingAccount, setEditingAccount] = useState(false)
  const [accountSearch, setAccountSearch] = useState("")
  const [accountsList, setAccountsList] = useState<{ id: string; name: string }[]>([])
  const [savingAccount, setSavingAccount] = useState(false)
  const [currentAccount, setCurrentAccount] = useState(order.account)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState("")
  const [savingNewAccount, setSavingNewAccount] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [resetToDraftModalOpen, setResetToDraftModalOpen] = useState(false)

  // Sends a PATCH to the quote and shows the server error message on failure
  async function patchOrder(body: Record<string, unknown>, url = `/api/devis/${order.id}`): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.error ?? `Erreur lors de l'enregistrement (${res.status})`)
        return false
      }
      return true
    } catch {
      alert("Erreur réseau lors de l'enregistrement")
      return false
    }
  }

  async function loadAccounts(q = "") {
    const res = await fetch(`/api/accounts?q=${encodeURIComponent(q)}`)
    if (res.ok) {
      const json = await res.json()
      setAccountsList((json.data ?? json) as { id: string; name: string }[])
    }
  }

  async function createAndSelectAccount() {
    if (!newAccountName.trim()) return
    setSavingNewAccount(true)
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAccountName.trim(), type: "enterprise" }),
    })
    if (res.ok) {
      const created = await res.json()
      const id = created.id ?? created.data?.id
      if (id) await saveAccount(id, newAccountName.trim())
    }
    setCreatingAccount(false)
    setNewAccountName("")
    setSavingNewAccount(false)
  }

  async function saveAccount(accountId: string, accountName: string) {
    setSavingAccount(true)
    const ok = await patchOrder({ account_id: accountId })
    if (ok) {
      setCurrentAccount({ id: accountId, name: accountName, country: currentAccount?.country ?? null })
      setEditingAccount(false)
      setAccountSearch("")
    }
    setSavingAccount(false)
  }

  const filteredAccounts = accountsList.filter(a =>
    a.name.toLowerCase().includes(accountSearch.toLowerCase())
  ).slice(0, 8)

  async function saveNotes(value: string) {
    setNotesSaving(true)
    await patchOrder({ notes: value || null })
    setNotesSaving(false)
  }

  async function saveAdditionalInfo(value: string) {
    setAdditionalInfoSaving(true)
    await patchOrder({ additional_info: value || null })
    setAdditionalInfoSaving(false)
  }
  const isInvoiced = order.status === "invoiced"
  const isCancelled = order.status === "cancelled"
  const isDraft = !isInvoiced && !isCancelled
  // Display only (D2): fields and lines are editable only with "devis.modifier"
  const canModify = can("devis.modifier")
  const canEdit = isDraft && canModify
  // E1: an invoiced quote is fully frozen, only the project stays editable
  // F3: a cancelled quote is entirely read-only, project included (server answers 409)
  const canEditUnlessInvoiced = canModify && !isInvoiced && !isCancelled
  const canEditProject = canModify && !isCancelled

  const PAYMENT_TERMS_LABELS: Record<string, string> = {
    immediate: t("paymentImmediate"),
    "15j": t("payment15j"),
    "21j": "21 jours",
    "30j": t("payment30j"),
    "45j": t("payment45j"),
    "60j": t("payment60j"),
    avance: t("paymentAdvance"),
  }

  const STEPS = [
    { key: "draft", label: t("stepDraft") },
    { key: "confirmed", label: t("stepConfirmed") },
    { key: "invoiced_pending", label: t("stepToInvoice") },
    { key: "invoiced", label: t("stepInvoiced") },
  ]

  const tabs = [
    { key: "lines", label: t("tabLines") },
    { key: "other", label: t("tabOther") },
    { key: "notes", label: t("tabNotes") },
  ] as const

  function getStockStatus(productId: string | null | undefined, qty: number): "ok" | "low" | "none" {
    if (!productId) return "ok"
    const avail = stockByProduct[productId] ?? 0
    if (avail >= qty) return "ok"
    if (avail > 0) return "low"
    return "none"
  }


  function lineTotal(l: Line) {
    if (isComment(l)) return 0
    return l.quantity * l.unit_price * (1 - l.discount / 100)
  }
  const total = lines.reduce((s, l) => s + lineTotal(l), 0)
  const totalTaxable = lines.filter(l => !l.tva_exempt).reduce((s, l) => s + lineTotal(l), 0)
  const tvaAmount = tva ? totalTaxable * 0.18 : 0
  const totalTTC = total + tvaAmount

  async function duplicate() {
    setLoading(true)
    const res = await fetch(`/api/devis/${order.id}/duplicate`, { method: "POST" })
    const json = await res.json()
    setLoading(false)
    if (json.id) router.push(`/${locale}/ventes/devis/${json.id}`)
  }

  async function toggleTva() {
    if (!canEditUnlessInvoiced) return
    const newVal = !tva
    setTva(newVal)
    const ok = await patchOrder({ tva: newVal })
    if (!ok) setTva(!newVal)
  }

  async function toggleLineExempt(lineId: string) {
    if (!canEditUnlessInvoiced) return
    const line = lines.find(l => l.id === lineId)
    if (!line) return
    const newVal = !line.tva_exempt
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, tva_exempt: newVal } : l))
    const ok = await patchOrder({ tva_exempt: newVal }, `/api/devis/${order.id}/lines/${lineId}`)
    if (!ok) setLines(prev => prev.map(l => l.id === lineId ? { ...l, tva_exempt: !newVal } : l))
  }

  async function updateLine(lineId: string, field: "description" | "quantity" | "unit_price" | "discount", value: string) {
    const numVal = field !== "description" ? parseFloat(value) || 0 : 0
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, [field]: field === "description" ? value : numVal } : l))
    await patchOrder({ [field]: field === "description" ? value : numVal }, `/api/devis/${order.id}/lines/${lineId}`)
  }

  async function deleteLine(lineId: string) {
    setLines(prev => prev.filter(l => l.id !== lineId))
    const res = await fetch(`/api/devis/${order.id}/lines/${lineId}`, { method: "DELETE" })
    if (!res.ok) {
      const json = await res.json()
      alert(`Erreur: ${json.error}`)
    }
  }

  // R1: a new line is always created from an active catalogue product (designation and price taken from it)
  async function addLine(p: CatalogProduct) {
    if (addingLine) return
    setAddingLine(true)
    try {
      const res = await fetch(`/api/devis/${order.id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: p.id, quantity: 1, discount: 0 }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Erreur: ${data.error ?? res.status}`)
        return
      }
      const unit = allProducts.find(ap => ap.id === p.id)?.unit ?? (p.unit ? { name: p.unit } : null)
      setLines(prev => [...prev, { ...data, product: { name: p.name, reference: p.reference }, unit, tva_exempt: data.tva_exempt ?? false }])
    } finally {
      setAddingLine(false)
    }
  }

  // Comment line: text only, no impact on totals, VAT or stock
  async function addComment() {
    const text = (newComment ?? "").trim()
    if (!text) { alert("Saisissez le texte du commentaire."); return }
    if (addingLine) return
    setAddingLine(true)
    try {
      const res = await fetch(`/api/devis/${order.id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_type: "comment", description: text, print_on_pdf: newCommentPrint, print_on_delivery: newCommentPrintDelivery }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Erreur: ${data.error ?? res.status}`)
        return
      }
      setLines(prev => [...prev, { ...data, line_type: "comment", product: null, unit: null }])
      setNewComment(null)
      setNewCommentPrint(true)
      setNewCommentPrintDelivery(false)
    } finally {
      setAddingLine(false)
    }
  }

  async function saveCommentText(lineId: string, value: string, previous: string) {
    if (!value.trim()) { alert("Un commentaire ne peut pas être vide : supprimez la ligne si elle n'est plus utile."); return false }
    if (value === previous) return true
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, description: value } : l))
    const ok = await patchOrder({ description: value }, `/api/devis/${order.id}/lines/${lineId}`)
    if (!ok) setLines(prev => prev.map(l => l.id === lineId ? { ...l, description: previous } : l))
    return ok
  }

  async function togglePrintOnPdf(lineId: string, value: boolean) {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, print_on_pdf: value } : l))
    const ok = await patchOrder({ print_on_pdf: value }, `/api/devis/${order.id}/lines/${lineId}`)
    if (!ok) setLines(prev => prev.map(l => l.id === lineId ? { ...l, print_on_pdf: !value } : l))
  }

  async function togglePrintOnDelivery(lineId: string, value: boolean) {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, print_on_delivery: value } : l))
    const ok = await patchOrder({ print_on_delivery: value }, `/api/devis/${order.id}/lines/${lineId}`)
    if (!ok) setLines(prev => prev.map(l => l.id === lineId ? { ...l, print_on_delivery: !value } : l))
  }

  // Attaches an old free line (no product) to a catalogue product; its description and price are kept
  async function attachProduct(lineId: string, p: CatalogProduct) {
    const ok = await patchOrder({ product_id: p.id }, `/api/devis/${order.id}/lines/${lineId}`)
    if (!ok) return
    const unit = allProducts.find(ap => ap.id === p.id)?.unit ?? (p.unit ? { name: p.unit } : null)
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, product_id: p.id, product: { name: p.name, reference: p.reference }, unit } : l))
  }

  // Old free lines (sales lines without product); comment lines are not free lines
  const freeLines = lines.filter(l => !l.product_id && !isComment(l))

  // Sends only the changed field: for project_code the body is exactly { project_code }
  async function updateOrderField(field: string, value: string) {
    setOrderFields(prev => ({ ...prev, [field]: value }))
    await patchOrder({ [field]: value || null })
  }

  async function confirm() {
    setLoading(true)
    const res = await fetch(`/api/devis/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    })
    if (!res.ok) {
      const json = await res.json()
      alert(json.error ?? "Erreur lors de la confirmation")
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
  }

  async function cancel() {
    setCancelModalOpen(false)
    setLoading(true)
    const res = await fetch(`/api/devis/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    })
    if (!res.ok) {
      const json = await res.json()
      alert(json.error ?? "Erreur lors de l'annulation")
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
  }

  async function resetToDraft() {
    setResetToDraftModalOpen(false)
    setLoading(true)
    const res = await fetch(`/api/devis/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    })
    if (!res.ok) {
      const json = await res.json()
      alert(json.error ?? "Erreur lors de la remise en brouillon")
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
  }

  async function createInvoice() {
    setLoading(true)
    const { supabase } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const res = await fetch(`/api/devis/${order.id}/create-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: order.account?.id ?? null,
        currency: orderFields.currency,
        tva,
        payment_terms: order.payment_terms ?? null,
        // Comment lines are copied as comments (text only, print setting kept)
        lines: lines.map(l => isComment(l) ? {
          line_type: "comment",
          description: l.description,
          quantity: 0,
          unit_price: 0,
          discount: 0,
          product_id: null,
          tva_exempt: false,
          unit_id: null,
          print_on_pdf: l.print_on_pdf !== false,
          print_on_delivery: l.print_on_delivery === true,
        } : {
          line_type: "product",
          print_on_pdf: l.print_on_pdf !== false,
          print_on_delivery: false,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount: l.discount,
          product_id: (l as unknown as { product_id?: string }).product_id ?? null,
          tva_exempt: l.tva_exempt ?? false,
          unit_id: (l as unknown as { unit_id?: string }).unit_id ?? null,
        }),
        user_id: user.id,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? "Erreur lors de la création de la facture")
      setLoading(false)
      return
    }
    router.push(`/${locale}/ventes/factures/${json.invoiceId}`)
  }

  const stepIndex = getStepIndex(order.status)

  return (
    <div className="max-w-5xl mx-auto">
      <Link href={`/${locale}/ventes/devis`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("backToQuotes")}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{order.number}</h1>
            {isCancelled && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-600">{t("statusCancelled")}</span>
            )}
          </div>
          <p className="text-gray-500 text-sm">{t("createdOn")} {formatDate(order.created_at, locale)}</p>
          {isCancelled && (
            <p className="mt-1 text-xs text-red-600">Devis annulé : non modifiable (numéro et historique conservés)</p>
          )}

          {/* Smart buttons : factures & livraisons liées */}
          {(invoiceCount > 0 || deliveryCount > 0) && (
            <div className="flex items-center gap-2 mt-3">
              {invoiceCount > 0 && (
                <Link
                  href={firstInvoiceId ? `/${locale}/ventes/factures/${firstInvoiceId}` : `/${locale}/ventes/factures`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-sm text-gray-700 transition-colors shadow-sm"
                >
                  <Receipt className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-blue-600">{invoiceCount}</span>
                  <span>{t("invoice")}{invoiceCount > 1 ? t("invoicePlural") : ""}</span>
                </Link>
              )}
              {deliveryCount > 0 && (
                <Link
                  href={`/${locale}/ventes/bons-livraison?order=${order.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-sm text-gray-700 transition-colors shadow-sm"
                >
                  <Truck className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-emerald-600">{deliveryCount}</span>
                  <span>{t("delivery")}{deliveryCount > 1 ? t("deliveryPlural") : ""}</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap justify-end">
          <a
            href={`/${locale}/ventes/devis/${order.id}/pdf`}
            target="_blank"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" /> {t("printPdf")}
          </a>
          <ShareButton
            documentId={order.id}
            number={order.number}
            clientName={order.account?.name}
            type="devis"
          />
          {/* Opens the delivery note creation form: needs "livraisons.creer" */}
          {order.status === "confirmed" && can("livraisons.creer") && (
            <a
              href={`/${locale}/ventes/devis/${order.id}/bon-livraison`}
              target="_blank"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <Receipt className="w-4 h-4" /> {t("deliverySlip")}
            </a>
          )}

          {/* Duplicate: needs "devis.creer" */}
          {can("devis.creer") && (
            <Button variant="secondary" onClick={duplicate} disabled={loading}>
              <Copy className="w-4 h-4" /> Dupliquer
            </Button>
          )}

          {/* Reset to draft: only from confirmed, never for an invoiced or cancelled quote (F3) */}
          {order.status === "confirmed" && canModify && (
            <Button variant="secondary" onClick={() => setResetToDraftModalOpen(true)} disabled={loading}>
              <RotateCcw className="w-4 h-4" /> {t("resetToDraft")}
            </Button>
          )}
          {/* Cancel: from draft or confirmed, never for an invoiced quote */}
          {["draft", "confirmed"].includes(order.status) && can("devis.annuler") && (
            <Button variant="danger" onClick={() => setCancelModalOpen(true)} disabled={loading}>
              <X className="w-4 h-4" /> {t("cancel")}
            </Button>
          )}
          {order.status === "draft" && can("devis.confirmer") && (
            <Button onClick={confirm} disabled={loading}>
              <CheckCircle className="w-4 h-4" /> {t("confirm")}
            </Button>
          )}
          {order.status === "confirmed" && can("factures.creer") && (
            <Button onClick={createInvoice} disabled={loading}>
              <Receipt className="w-4 h-4" /> {loading ? t("creating") : t("createInvoice")}
            </Button>
          )}
        </div>
      </div>

      {/* Stepper Odoo style */}
      {!isCancelled && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex items-center">
            {STEPS.map((step, i) => {
              const isActive = i === stepIndex
              const isDone = i < stepIndex
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    isActive ? "text-blue-600" : isDone ? "text-gray-700" : "text-gray-400"
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 transition-colors ${
                      isActive
                        ? "border-blue-600 bg-blue-600 text-white"
                        : isDone
                        ? "border-gray-400 bg-gray-400 text-white"
                        : "border-gray-200 bg-white text-gray-400"
                    }`}>
                      {isDone ? "✓" : i + 1}
                    </div>
                    <span>{step.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 ${i < stepIndex ? "bg-gray-400" : "bg-gray-200"}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Infos client */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t("fieldClient")}</p>
              {editingAccount ? (
                <div className="relative">
                  <input
                    autoFocus
                    type="text"
                    value={accountSearch}
                    onChange={e => { setAccountSearch(e.target.value); loadAccounts(e.target.value) }}
                    placeholder="Rechercher un client..."
                    className="w-56 text-sm border border-blue-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="absolute z-50 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {filteredAccounts.map(a => (
                      <button key={a.id} onClick={() => saveAccount(a.id, a.name)} disabled={savingAccount}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition">
                        {a.name}
                      </button>
                    ))}
                    {creatingAccount ? (
                      <div className="px-3 py-2 border-t border-gray-100">
                        <input
                          autoFocus
                          type="text"
                          value={newAccountName}
                          onChange={e => setNewAccountName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") createAndSelectAccount(); if (e.key === "Escape") setCreatingAccount(false) }}
                          placeholder="Nom du client..."
                          className="w-full text-sm border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="flex gap-2 mt-1.5">
                          <button onClick={createAndSelectAccount} disabled={savingNewAccount || !newAccountName.trim()}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                            {savingNewAccount ? "..." : "Créer"}
                          </button>
                          <button onClick={() => { setCreatingAccount(false); setNewAccountName("") }}
                            className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
                        </div>
                      </div>
                    ) : can("comptes.creer") && (
                      <button onClick={() => setCreatingAccount(true)}
                        className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 flex items-center gap-1.5 transition">
                        <span className="font-bold">+</span> Nouveau client
                      </button>
                    )}
                  </div>
                  <button onClick={() => { setEditingAccount(false); setAccountSearch(""); setCreatingAccount(false) }} className="ml-2 text-xs text-gray-400 hover:text-gray-600">Annuler</button>
                </div>
              ) : !canEditUnlessInvoiced ? (
                <p className="text-sm text-gray-900">{currentAccount?.name ?? "—"}</p>
              ) : (
                <button
                  onClick={() => { setEditingAccount(true); loadAccounts("") }}
                  className="text-sm text-left group text-gray-900 hover:text-blue-600 hover:underline cursor-pointer"
                >
                  {currentAccount?.name ?? "—"}
                  <span className="ml-1 opacity-0 group-hover:opacity-100 text-blue-400 text-xs">✎</span>
                </button>
              )}
            </div>
            {order.contact && (
              <Field label={t("fieldContact")} value={`${order.contact.first_name} ${order.contact.last_name}`} />
            )}
            {order.salesperson && (
              <Field label={t("fieldSalesperson")} value={order.salesperson.full_name} />
            )}
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t("fieldClientRef")}</p>
              {canEdit ? (
                <input
                  className="w-full text-sm text-gray-900 bg-transparent border-b border-gray-200 hover:border-gray-400 focus:border-blue-500 focus:outline-none py-0.5"
                  value={orderFields.client_order_ref}
                  onChange={e => setOrderFields(p => ({ ...p, client_order_ref: e.target.value }))}
                  onBlur={e => updateOrderField("client_order_ref", e.target.value)}
                  placeholder="Réf. commande client..."
                />
              ) : (
                <p className="text-sm text-gray-900 font-mono">{order.client_order_ref ?? "—"}</p>
              )}
            </div>
          </div>
          <div className="space-y-4">
            {/* Order date stays editable until the quote is invoiced (or cancelled) */}
            {canEdit ? (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{t("fieldOrderDate")}</p>
                <input
                  type="date"
                  className="text-sm font-semibold text-gray-900 bg-transparent border-b border-gray-200 hover:border-gray-400 focus:border-blue-500 focus:outline-none py-0.5"
                  value={orderFields.date_order}
                  onChange={e => setOrderFields(p => ({ ...p, date_order: e.target.value }))}
                  onBlur={e => { if (e.target.value) updateOrderField("date_order", e.target.value) }}
                />
              </div>
            ) : (
              <Field label={t("fieldOrderDate")} value={order.date_order ? formatDate(order.date_order, locale) : formatDate(order.created_at, locale)} />
            )}
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t("fieldExpiry")}</p>
              {canEdit ? (
                <input
                  type="date"
                  className="text-sm text-gray-900 bg-transparent border-b border-gray-200 hover:border-gray-400 focus:border-blue-500 focus:outline-none py-0.5"
                  value={orderFields.valid_until}
                  onChange={e => setOrderFields(p => ({ ...p, valid_until: e.target.value }))}
                  onBlur={e => updateOrderField("valid_until", e.target.value)}
                />
              ) : (
                <p className="text-sm text-gray-900">{order.valid_until ? formatDate(order.valid_until, locale) : "—"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t("fieldPaymentTerms")}</p>
              {canEdit ? (
                <select
                  className="text-sm text-gray-900 bg-transparent border-b border-gray-200 hover:border-gray-400 focus:border-blue-500 focus:outline-none py-0.5 w-full"
                  value={orderFields.payment_terms}
                  onChange={e => { setOrderFields(p => ({ ...p, payment_terms: e.target.value })); updateOrderField("payment_terms", e.target.value) }}
                >
                  <option value="">— Choisir —</option>
                  {Object.entries(PAYMENT_TERMS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-900">{order.payment_terms ? (PAYMENT_TERMS_LABELS[order.payment_terms] ?? order.payment_terms) : "—"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t("fieldCurrency")}</p>
              {canEdit ? (
                <select
                  className="text-sm text-gray-900 bg-transparent border-b border-gray-200 hover:border-gray-400 focus:border-blue-500 focus:outline-none py-0.5 w-full"
                  value={orderFields.currency}
                  onChange={e => { setOrderFields(p => ({ ...p, currency: e.target.value })); updateOrderField("currency", e.target.value) }}
                >
                  {(["GNF","USD","EUR","GBP","XOF","SGD","CNY"] as const).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-900 font-medium">{orderFields.currency}</p>
              )}
            </div>
            {/* The project only classifies the quote for reporting: editable even when invoiced (E1), never when cancelled (F3) */}
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Projet</p>
              <select
                className="text-sm text-gray-900 bg-transparent border-b border-gray-200 hover:border-gray-400 focus:border-blue-500 focus:outline-none py-0.5 w-full disabled:border-transparent disabled:appearance-none"
                value={orderFields.project_code}
                onChange={e => updateOrderField("project_code", e.target.value)}
                disabled={!canEditProject}
              >
                <option value="">—</option>
                {PROJECT_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            {order.commission_client != null && <Field label="Commission client" value={`${order.commission_client}%`} />}
          </div>
        </div>
        {(order.title || order.conditions_generales) && (
          <div className="px-6 pb-4 border-t border-gray-100 pt-3 space-y-2">
            {order.title && (
              <div>
                <p className="text-xs text-gray-400">Sujet</p>
                <p className="text-sm font-medium text-gray-900">{order.title}</p>
              </div>
            )}
            {order.conditions_generales && (
              <div>
                <p className="text-xs text-gray-400">Conditions générales</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{order.conditions_generales}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex border-b border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "lines" && (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t("colDescription")}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colQty")}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colUnitPrice")}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colDiscount")} %</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colStock")}</th>
                  {tva && <th className="text-center px-4 py-3 font-medium text-gray-600 text-xs">Sans TVA</th>}
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t("colSubtotal")}</th>
                  {canEdit && <th className="px-2 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lines.map(l => isComment(l) ? (
                  <tr key={l.id} className="bg-gray-50">
                    <td colSpan={tva ? 7 : 6} className="px-4 py-2">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0 text-[11px] px-1.5 py-0.5 rounded font-medium bg-gray-200 text-gray-600">Commentaire</span>
                        {canEdit ? (
                          <textarea
                            rows={1}
                            defaultValue={l.description}
                            onBlur={async e => {
                              const el = e.currentTarget
                              const ok = await saveCommentText(l.id, el.value, l.description)
                              if (!ok) el.value = l.description
                            }}
                            placeholder="Texte du commentaire…"
                            className="flex-1 text-sm italic text-gray-600 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none resize-y py-0.5"
                          />
                        ) : (
                          <p className="flex-1 text-sm italic text-gray-600 whitespace-pre-line">{l.description}</p>
                        )}
                        {canEdit ? (
                          <div className="mt-0.5 shrink-0 flex flex-col gap-1">
                            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                              <input type="checkbox" checked={l.print_on_pdf !== false} onChange={e => togglePrintOnPdf(l.id, e.target.checked)} />
                              Imprimer sur le devis
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                              <input type="checkbox" checked={l.print_on_delivery === true} onChange={e => togglePrintOnDelivery(l.id, e.target.checked)} />
                              Imprimer sur le bon de livraison
                            </label>
                          </div>
                        ) : (
                          <div className="mt-0.5 shrink-0 flex flex-col gap-0.5 text-xs text-gray-400">
                            <span>{l.print_on_pdf !== false ? "Imprimé sur le devis" : "Non imprimé sur le devis"}</span>
                            <span>{l.print_on_delivery === true ? "Imprimé sur le bon de livraison" : "Non imprimé sur le bon de livraison"}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    {canEdit && (
                      <td className="px-2 py-2">
                        <button
                          onClick={() => deleteLine(l.id)}
                          title="Supprimer le commentaire"
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ) : (
                  <tr key={l.id} className={l.tva_exempt ? "bg-gray-50/50" : ""}>
                    <td className="px-4 py-2">
                      {canEdit ? (
                        <div className="relative flex items-start gap-2">
                          {l.product_id && allProducts.find(p => p.id === l.product_id)?.image_url && (
                            <img
                              src={allProducts.find(p => p.id === l.product_id)!.image_url!}
                              alt=""
                              className="w-9 h-9 rounded object-cover border border-gray-100 flex-shrink-0 mt-0.5"
                            />
                          )}
                        <div className="relative flex-1">
                          {/* The product is fixed (chosen from the catalogue); only the line text stays editable */}
                          <input
                            className="w-full text-sm font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-0.5"
                            defaultValue={l.description}
                            onBlur={e => { if (e.target.value !== l.description) updateLine(l.id, "description", e.target.value) }}
                            placeholder="Description de la ligne"
                          />
                          {l.product_id ? (
                            l.product && (
                              <p className="text-xs text-gray-400">
                                {l.product.name}{l.product.reference && <span className="font-mono"> · {l.product.reference}</span>}
                              </p>
                            )
                          ) : (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                                Ligne libre — à rattacher à un produit
                              </span>
                              <button type="button" onClick={() => setPickerTarget(l.id)} className="text-xs text-blue-600 hover:text-blue-500 font-medium">
                                Rattacher à un produit
                              </button>
                            </div>
                          )}
                        </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          {l.product_id && (() => {
                            const img = allProducts.find(p => p.id === l.product_id)?.image_url
                            return img ? <img src={img} alt="" className="w-9 h-9 rounded object-cover border border-gray-100 flex-shrink-0" /> : null
                          })()}
                          <div>
                            <p className="font-medium text-gray-900">{l.description}</p>
                            {l.product?.reference && <p className="text-xs text-gray-400 font-mono">{l.product.reference}</p>}
                            {!l.product_id && !isCancelled && !isInvoiced && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                                Ligne libre — à rattacher à un produit
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {canEdit ? (
                        <input
                          type="number" min="0" step="any"
                          className="w-20 text-sm text-right text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-0.5"
                          defaultValue={l.quantity}
                          onBlur={e => updateLine(l.id, "quantity", e.target.value)}
                        />
                      ) : (
                        <span className="text-gray-700">{formatNumber(l.quantity)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {canEdit ? (
                        <input
                          type="number" step="any"
                          className="w-24 text-sm text-right text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-0.5"
                          defaultValue={l.unit_price}
                          onBlur={e => updateLine(l.id, "unit_price", e.target.value)}
                        />
                      ) : (
                        <span className="text-gray-700">{formatNumber(l.unit_price)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {canEdit ? (
                        <input
                          type="number" min="0" max="100" step="any"
                          className="w-16 text-sm text-right text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-0.5"
                          defaultValue={l.discount}
                          onBlur={e => updateLine(l.id, "discount", e.target.value)}
                        />
                      ) : (
                        <span className="text-gray-500">{l.discount > 0 ? `${l.discount}%` : "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {(() => {
                        const pid = (l as unknown as { product_id: string }).product_id
                        const status = getStockStatus(pid, l.quantity)
                        if (!pid) return <span className="text-gray-300 text-xs">—</span>
                        // Services are never stock-checked (R5)
                        if (availability[pid]?.service) return <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">Service</span>
                        if (status === "ok") return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">✓ {t("stockOk")}</span>
                        if (status === "low") return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">⚠ {t("stockLow")}</span>
                        return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">✗ {t("stockNone")}</span>
                      })()}
                    </td>
                    {tva && (
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => toggleLineExempt(l.id)}
                          disabled={!canEditUnlessInvoiced}
                          title={l.tva_exempt ? "Cliquer pour appliquer la TVA" : "Cliquer pour exempter de TVA"}
                          className={`w-8 h-4 rounded-full transition-colors relative inline-flex items-center ${l.tva_exempt ? "bg-amber-400" : "bg-gray-200"}`}
                        >
                          <span className={`absolute w-3 h-3 rounded-full bg-white shadow transition-transform ${l.tva_exempt ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">
                      {formatNumber(lineTotal(l))}
                    </td>
                    {canEdit && (
                      <td className="px-2 py-2">
                        <button
                          onClick={() => deleteLine(l.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {canEdit && (
              <div className="px-4 py-3 border-t border-gray-50 flex items-center gap-4 flex-wrap">
                <button
                  onClick={() => setPickerTarget("new")}
                  disabled={addingLine}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  {addingLine ? "Ajout..." : "Ajouter une ligne"}
                </button>
                <button
                  onClick={() => setNewComment(c => c ?? "")}
                  disabled={addingLine || newComment !== null}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un commentaire
                </button>
                <span className="text-xs text-gray-400">Chaque ligne de vente doit être un produit ou un service du catalogue. Un commentaire contient seulement du texte.</span>
              </div>
            )}
            {canEdit && newComment !== null && (
              <div className="mx-4 mb-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-[11px] px-1.5 py-0.5 rounded font-medium bg-gray-200 text-gray-600">Commentaire</span>
                  <textarea
                    autoFocus
                    rows={2}
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Texte du commentaire…"
                    className="flex-1 text-sm italic text-gray-700 bg-white border border-gray-200 rounded px-2 py-1 focus:border-blue-500 focus:outline-none resize-y"
                  />
                </div>
                <div className="flex items-center gap-4 justify-end">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mr-auto">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                      <input type="checkbox" checked={newCommentPrint} onChange={e => setNewCommentPrint(e.target.checked)} />
                      Imprimer sur le devis
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                      <input type="checkbox" checked={newCommentPrintDelivery} onChange={e => setNewCommentPrintDelivery(e.target.checked)} />
                      Imprimer sur le bon de livraison
                    </label>
                  </div>
                  <button onClick={() => { setNewComment(null); setNewCommentPrint(true); setNewCommentPrintDelivery(false) }} className="text-xs text-gray-500 hover:text-gray-700">Annuler</button>
                  <button
                    onClick={addComment}
                    disabled={addingLine || !newComment.trim()}
                    className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingLine ? "Ajout..." : "Ajouter le commentaire"}
                  </button>
                </div>
              </div>
            )}

            {/* R1: free lines left from before the rule block the confirmation */}
            {freeLines.length > 0 && !isCancelled && !isInvoiced && (
              <div className="mx-4 mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {freeLines.length > 1 ? `${freeLines.length} lignes libres` : "1 ligne libre"} sans produit du catalogue.
                {order.status === "draft"
                  ? " Le devis ne pourra pas être confirmé tant qu'elles ne sont pas rattachées à un produit ou un service du catalogue (ou supprimées)."
                  : " Rattachez-les à un produit ou un service du catalogue."}
              </div>
            )}

            {/* R3: non-blocking stock alerts (services and comments never checked) */}
            {!isCancelled && !isInvoiced && (
              <StockAlert
                className="mx-4 mb-3"
                lines={lines.filter(l => !isComment(l)).map(l => ({ product_id: l.product_id, quantity: l.quantity }))}
                onAvailability={setAvailability}
              />
            )}

            <div className="border-t border-gray-100 px-6 py-4 flex items-start justify-between gap-4">
              {/* Toggle TVA global */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTva}
                  disabled={!canEditUnlessInvoiced}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${tva ? "bg-blue-600" : "bg-gray-200"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${tva ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <span className="text-sm text-gray-600">TVA 18%</span>
              </div>

              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{t("totalHT")}</span>
                  <span className="font-semibold text-gray-900">{formatNumber(total)} {orderFields.currency}</span>
                </div>
                {tva && (
                  <>
                    {lines.some(l => l.tva_exempt) && (
                      <div className="flex justify-between text-xs text-amber-600">
                        <span>Base taxable</span>
                        <span>{formatNumber(totalTaxable)} {orderFields.currency}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>TVA 18%</span>
                      <span className="font-semibold text-gray-900">{formatNumber(tvaAmount)} {orderFields.currency}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-2">
                      <span>Total TTC</span>
                      <span>{formatNumber(totalTTC)} {orderFields.currency}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "other" && (
          <div className="p-6">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Commentaires destinés au client (imprimés)
            </label>
            <textarea
              value={additionalInfo}
              onChange={e => setAdditionalInfo(e.target.value)}
              onBlur={e => { if (canEditUnlessInvoiced) saveAdditionalInfo(e.target.value) }}
              readOnly={!canEditUnlessInvoiced}
              rows={6}
              placeholder="Texte imprimé sur le devis (conditions, termes de livraison, remarques…)"
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              {additionalInfoSaving ? "Sauvegarde..." : "Imprimé sur le devis : PDF, page d'impression et lien de partage."}
            </p>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="p-6">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Commentaires internes (non imprimés)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={e => { if (canEditUnlessInvoiced) saveNotes(e.target.value) }}
              readOnly={!canEditUnlessInvoiced}
              rows={6}
              placeholder={t("noNotes")}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              {notesSaving ? "Sauvegarde..." : "Jamais imprimés ni accessibles au client. Sauvegarde automatique à la perte du focus."}
            </p>
          </div>
        )}
      </div>

      {/* Activité */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mt-6">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">Activité</p>
        <ActivityLog resource="devis" resourceId={order.id} />
      </div>

      {/* Catalogue picker: add a line or attach a free line (creation inside, gated by "produits.gerer") */}
      <ProductPickerDialog
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        title={pickerTarget === "new" ? "Ajouter une ligne" : "Rattacher la ligne à un produit ou un service"}
        locale={locale}
        currency={orderFields.currency}
        initialQuery={pickerTarget && pickerTarget !== "new" ? (lines.find(l => l.id === pickerTarget)?.description ?? "") : ""}
        onSelect={p => {
          if (pickerTarget === "new") addLine(p)
          else if (pickerTarget) attachProduct(pickerTarget, p)
        }}
      />

      {/* Modal annulation devis */}
      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Annuler le devis ?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Le devis <strong>{order.number}</strong> passera au statut <strong>Annulé</strong>. Cette action peut être défaite en remettant le devis en brouillon.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>Retour</Button>
            <Button variant="danger" onClick={cancel} disabled={loading}>
              {loading ? "Annulation…" : "Confirmer l'annulation"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal remise en brouillon devis */}
      <Modal open={resetToDraftModalOpen} onClose={() => setResetToDraftModalOpen(false)} title="Remettre en brouillon ?">
        <div className="space-y-4">
          {order.status === "invoiced" ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <strong>Attention :</strong> ce devis a déjà été facturé. Remettre en brouillon ne supprimera pas la facture associée.
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Le devis <strong>{order.number}</strong> repassera au statut <strong>Brouillon</strong> et sera à nouveau modifiable.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setResetToDraftModalOpen(false)}>Retour</Button>
            <Button onClick={resetToDraft} disabled={loading}>
              {loading ? "En cours…" : "Remettre en brouillon"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Zone d'impression */}
      <div className="print-root hidden print:block">
        <DocumentLayout
          type="devis"
          number={order.number}
          date={order.created_at}
          validUntil={order.valid_until ?? undefined}
          settings={docSettings}
          recipientName={order.account?.name ?? "—"}
          recipientCountry={order.account?.country ?? undefined}
          lines={order.lines}
          notes={notes || undefined}
          currency={orderFields.currency}
          locale={locale}
        />
      </div>
    </div>
  )
}

function Field({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-semibold text-gray-900 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
    </div>
  )
}
