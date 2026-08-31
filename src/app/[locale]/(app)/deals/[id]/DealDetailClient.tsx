"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, MessageSquare, Mail, Phone, Users, Globe, HelpCircle,
  AlertCircle, CheckCircle2, Clock, PhoneCall, FileText, StickyNote,
  Edit2, Plus, Calendar, User, Zap, Pencil, Trash2, ArrowLeftRight,
  TrendingUp
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { DealStage } from "@/types"
import DealFinancialsPanel from "@/components/DealFinancialsPanel"

interface Activity {
  id: string
  type: string
  subject: string
  notes: string | null
  date: string
  follow_up_date: string | null
  completed: boolean
  user_id: string
}

interface Deal {
  id: string
  title: string
  stage: DealStage
  value: number | null
  currency: string
  priority: string
  source: string | null
  source_detail: string | null
  products_requested: string | null
  notes: string | null
  next_action: string | null
  next_action_date: string | null
  assigned_to: string[]
  account_id: string | null
  prospect_name: string | null
  created_at: string
  account: { id: string; name: string; type: string } | null
  assignedEmployees: { id: string; full_name: string | null; email: string }[]
  deal_date: string | null
  country: string | null
  original_request: string | null
  contact_name: string | null
  contact_role: string | null
  contact_email: string | null
  contact_phone: string | null
  sector: string[] | null
  preferred_channel: string | null
  selling_price: number | null
  cost: number | null
  invoice: { id: string; number: string; status: string; total_ht: number | null; currency: string } | null
}

interface UserProfile {
  id: string
  full_name: string | null
  email: string
}

type LinkedDevis = {
  id: string
  number: string
  status: string
  total_ttc: number | null
  currency: string
  created_at: string
  account: { id: string; name: string } | null
}

interface Props {
  deal: Deal
  activities: Activity[]
  profiles: UserProfile[]
  accounts: { id: string; name: string }[]
  linkedDevis: LinkedDevis[]
  schema: string
}

const STAGES: DealStage[] = ["lead", "qualified", "proposal", "negotiation", "won", "lost"]

const STAGE_LABELS: Record<DealStage, string> = {
  lead: "Nouvelle demande",
  qualified: "Qualifié",
  proposal: "Devis envoyé",
  negotiation: "Négociation",
  won: "Gagné",
  lost: "Perdu",
}

const STAGE_CHIP: Record<DealStage, string> = {
  lead: "bg-gray-100 text-gray-700",
  qualified: "bg-blue-100 text-blue-700",
  proposal: "bg-yellow-100 text-yellow-700",
  negotiation: "bg-purple-100 text-purple-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
}

const SOURCE_ICON: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="w-4 h-4 text-green-600" />,
  email: <Mail className="w-4 h-4 text-blue-600" />,
  phone: <Phone className="w-4 h-4 text-orange-500" />,
  referral: <Users className="w-4 h-4 text-purple-600" />,
  website: <Globe className="w-4 h-4 text-sky-500" />,
  other: <HelpCircle className="w-4 h-4 text-gray-400" />,
}

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  phone: "Téléphone",
  referral: "Référence",
  website: "Site web",
  other: "Autre",
}

const ACTIVITY_TYPE_ICON: Record<string, React.ReactNode> = {
  note: <StickyNote className="w-4 h-4 text-gray-500" />,
  call: <PhoneCall className="w-4 h-4 text-blue-500" />,
  email: <Mail className="w-4 h-4 text-indigo-500" />,
  meeting: <Users className="w-4 h-4 text-purple-500" />,
  whatsapp: <MessageSquare className="w-4 h-4 text-green-500" />,
}

const ACTIVITY_TYPES = [
  { value: "mise_en_relation", label: "Mise en relation-client", icon: <Users className="w-4 h-4" /> },
  { value: "distribution", label: "Distribution", icon: <PhoneCall className="w-4 h-4" /> },
  { value: "vente", label: "Vente", icon: <MessageSquare className="w-4 h-4" /> },
  { value: "achat", label: "Achat", icon: <Mail className="w-4 h-4" /> },
  { value: "note", label: "Note", icon: <StickyNote className="w-4 h-4" /> },
  { value: "autres", label: "Autres", icon: <FileText className="w-4 h-4" /> },
]

const QUICK_ACTIONS = [
  { type: "call", label: "Appel fait", icon: <PhoneCall className="w-3.5 h-3.5" />, color: "text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-100" },
  { type: "whatsapp", label: "WhatsApp", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-green-600 bg-green-50 hover:bg-green-100 border-green-100" },
  { type: "email", label: "Email envoyé", icon: <Mail className="w-3.5 h-3.5" />, color: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-100" },
  { type: "note", label: "Note rapide", icon: <StickyNote className="w-3.5 h-3.5" />, color: "text-gray-600 bg-gray-50 hover:bg-gray-100 border-gray-200" },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function DealDetailClient({ deal: initial, activities: initialActs, profiles, accounts, linkedDevis: initialLinkedDevis, schema }: Props) {
  const router = useRouter()
  const [deal, setDeal] = useState(initial)
  const [activities, setActivities] = useState(initialActs)
  const [stageSaving, setStageSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: deal.title,
    products_requested: deal.products_requested ?? "",
    notes: deal.notes ?? "",
    next_action: deal.next_action ?? "",
    next_action_date: deal.next_action_date ?? "",
    assigned_to: deal.assigned_to ?? [],
    priority: deal.priority,
    value: deal.value?.toString() ?? "",
    currency: deal.currency,
    deal_date: deal.deal_date ?? "",
    country: deal.country ?? "",
    original_request: deal.original_request ?? "",
    contact_name: deal.contact_name ?? "",
    contact_role: deal.contact_role ?? "",
    contact_email: deal.contact_email ?? "",
    contact_phone: deal.contact_phone ?? "",
    sector: deal.sector ?? [] as string[],
    preferred_channel: deal.preferred_channel ?? "",
    selling_price: deal.selling_price?.toString() ?? "",
    cost: deal.cost?.toString() ?? "",
  })
  const [activityModal, setActivityModal] = useState(false)
  const [actForm, setActForm] = useState({ type: "mise_en_relation", subject: "", notes: "", date: new Date().toISOString().slice(0, 16), follow_up_date: "" })
  const [actSaving, setActSaving] = useState(false)
  const [quickNote, setQuickNote] = useState("")
  const [quickType, setQuickType] = useState<string | null>(null)
  const [quickSaving, setQuickSaving] = useState(false)
  const [linkedDevis, setLinkedDevis] = useState<LinkedDevis[]>(initialLinkedDevis)
  const [devisPickerOpen, setDevisPickerOpen] = useState(false)
  const [devisSearch, setDevisSearch] = useState("")
  const [devisResults, setDevisResults] = useState<LinkedDevis[]>([])
  const [devisLinking, setDevisLinking] = useState(false)
  const [linkedInvoice, setLinkedInvoice] = useState(initial.invoice ?? null)
  const [invoicePickerOpen, setInvoicePickerOpen] = useState(false)
  const [invoiceSearch, setInvoiceSearch] = useState("")
  const [invoiceResults, setInvoiceResults] = useState<{ id: string; number: string; status: string; total_ht: number | null; currency: string }[]>([])
  const [invoiceLinking, setInvoiceLinking] = useState(false)
  const [editingActId, setEditingActId] = useState<string | null>(null)
  const [editActForm, setEditActForm] = useState({ subject: "", notes: "", type: "note" })
  const [editActSaving, setEditActSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [leftTab, setLeftTab] = useState<"resume" | "activite" | "finances">("resume")

  async function changeStage(newStage: DealStage) {
    if (newStage === deal.stage || stageSaving) return
    setStageSaving(true)
    const prev = deal.stage
    setDeal(d => ({ ...d, stage: newStage }))
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    })
    if (!res.ok) setDeal(d => ({ ...d, stage: prev }))
    setStageSaving(false)
  }

  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const VALUE_STAGES: DealStage[] = ["qualified", "proposal", "negotiation", "won", "lost"]
  const showValue = VALUE_STAGES.includes(deal.stage)

  async function saveEdit() {
    setSaveError(null)
    setSaving(true)
    const body: Record<string, unknown> = {
      title: editForm.title,
      products_requested: editForm.products_requested || null,
      notes: editForm.notes || null,
      next_action: editForm.next_action || null,
      next_action_date: editForm.next_action_date || null,
      assigned_to: editForm.assigned_to,
      priority: editForm.priority,
      deal_date: editForm.deal_date || null,
      country: editForm.country || null,
      original_request: editForm.original_request || null,
      contact_name: editForm.contact_name || null,
      contact_role: editForm.contact_role || null,
      contact_email: editForm.contact_email || null,
      contact_phone: editForm.contact_phone || null,
      sector: editForm.sector,
      preferred_channel: editForm.preferred_channel || null,
    }
    if (showValue) {
      body.value = editForm.value ? parseFloat(editForm.value) : null
      body.currency = editForm.currency
      body.selling_price = editForm.selling_price ? parseFloat(editForm.selling_price) : null
      body.cost = editForm.cost ? parseFloat(editForm.cost) : null
    }
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok) {
      setDeal(d => ({ ...d, ...data }))
      setEditing(false)
    } else {
      setSaveError(data.error ?? "Erreur lors de l'enregistrement")
    }
    setSaving(false)
  }

  async function quickLog(type: string) {
    const labels: Record<string, string> = { call: "Appel téléphonique", whatsapp: "Message WhatsApp", email: "Email envoyé", note: "Note" }
    setQuickSaving(true)
    const res = await fetch(`/api/deals/${deal.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        subject: labels[type] ?? type,
        notes: quickNote || null,
        date: new Date().toISOString().slice(0, 16),
        follow_up_date: null,
        deal_id: deal.id,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setActivities(prev => [data, ...prev])
      setQuickNote("")
      setQuickType(null)
    }
    setQuickSaving(false)
  }

  function startEditAct(act: typeof activities[0]) {
    setEditingActId(act.id)
    setEditActForm({ subject: act.subject, notes: act.notes ?? "", type: act.type })
  }

  async function saveEditAct() {
    if (!editingActId) return
    setEditActSaving(true)
    const res = await fetch(`/api/deals/${deal.id}/activities/${editingActId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editActForm),
    })
    if (res.ok) {
      const updated = await res.json()
      setActivities(prev => prev.map(a => a.id === editingActId ? { ...a, ...updated } : a))
      setEditingActId(null)
    }
    setEditActSaving(false)
  }

  async function deleteActivity(actId: string) {
    if (!confirm("Supprimer cette activité ?")) return
    const res = await fetch(`/api/deals/${deal.id}/activities/${actId}`, { method: "DELETE" })
    if (res.ok) setActivities(prev => prev.filter(a => a.id !== actId))
  }

  async function searchDevis(q: string) {
    setDevisSearch(q)
    const res = await fetch(`/api/devis/search?q=${encodeURIComponent(q)}`)
    if (res.ok) {
      const data = await res.json()
      const linkedIds = new Set(linkedDevis.map(d => d.id))
      setDevisResults(data.filter((d: LinkedDevis) => !linkedIds.has(d.id)))
    }
  }

  async function linkDevis(devisId: string) {
    setDevisLinking(true)
    const res = await fetch(`/api/deals/${deal.id}/devis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ devis_id: devisId }),
    })
    if (res.ok) {
      const data = await res.json()
      setLinkedDevis(prev => [data, ...prev])
      setDevisPickerOpen(false)
      setDevisSearch("")
      setDevisResults([])
    }
    setDevisLinking(false)
  }

  async function unlinkDevis(devisId: string) {
    if (!confirm("Dissocier ce devis de l'opportunité ?")) return
    const res = await fetch(`/api/deals/${deal.id}/devis`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ devis_id: devisId }),
    })
    if (res.ok) setLinkedDevis(prev => prev.filter(d => d.id !== devisId))
  }

  async function searchInvoices(q: string) {
    setInvoiceSearch(q)
    if (q.length < 2) { setInvoiceResults([]); return }
    const res = await fetch(`/api/invoices/search?q=${encodeURIComponent(q)}`)
    if (res.ok) {
      const data = await res.json()
      setInvoiceResults(data)
    }
  }

  async function linkInvoice(invoiceId: string) {
    setInvoiceLinking(true)
    const res = await fetch(`/api/deals/${deal.id}/invoice`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_id: invoiceId }),
    })
    if (res.ok) {
      const data = await res.json()
      setLinkedInvoice(data)
      setInvoicePickerOpen(false)
      setInvoiceSearch("")
      setInvoiceResults([])
    }
    setInvoiceLinking(false)
  }

  async function unlinkInvoice() {
    if (!linkedInvoice) return
    if (!confirm("Dissocier cette facture du deal ?")) return
    const res = await fetch(`/api/deals/${deal.id}/invoice`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_id: null }),
    })
    if (res.ok) setLinkedInvoice(null)
  }

  async function addActivity() {
    if (!actForm.subject.trim()) return
    setActSaving(true)
    const res = await fetch(`/api/deals/${deal.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: actForm.type,
        subject: actForm.subject,
        notes: actForm.notes || null,
        date: actForm.date,
        follow_up_date: actForm.follow_up_date || null,
        deal_id: deal.id,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setActivities(prev => [data, ...prev])
      setActivityModal(false)
      setActForm({ type: "note", subject: "", notes: "", date: new Date().toISOString().slice(0, 16), follow_up_date: "" })
    }
    setActSaving(false)
  }

  const clientName = deal.account?.name ?? deal.prospect_name ?? "Prospect inconnu"

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back + header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => router.back()} className="mt-1 p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STAGE_CHIP[deal.stage]}`}>{STAGE_LABELS[deal.stage]}</span>
            {deal.priority === "urgent" && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3" /> Urgent
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{deal.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clientName} · Créé le {formatDate(deal.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            <Edit2 className="w-3.5 h-3.5" /> Modifier
          </button>
          <button
            disabled={actionLoading}
            onClick={async () => {
              const target = schema === "geg_guinee" ? "Singapore" : "Guinée"
              if (!confirm(`Transférer vers GEG ${target} ?`)) return
              setActionLoading(true)
              const res = await fetch(`/api/deals/${deal.id}/transfer`, { method: "POST" })
              if (res.ok) { router.back() } else { const { error } = await res.json(); alert("Erreur : " + error) }
              setActionLoading(false)
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {schema === "geg_guinee" ? "→ Singapore" : "→ Guinée"}
          </button>
          <button
            disabled={actionLoading}
            onClick={async () => {
              if (!confirm("Supprimer définitivement ce lead ?")) return
              setActionLoading(true)
              const res = await fetch(`/api/deals/${deal.id}/delete`, { method: "DELETE" })
              if (res.ok) { router.push("../deals"); router.refresh() } else { const { error } = await res.json(); alert("Erreur : " + error) }
              setActionLoading(false)
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Supprimer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left col */}
        <div className="lg:col-span-2 space-y-5">

          {/* Pipeline bar */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-medium text-gray-500 mb-3">Étape du pipeline</p>
            <div className="flex gap-1">
              {STAGES.map((s, i) => {
                const current = deal.stage === s
                const past = STAGES.indexOf(deal.stage) > i
                return (
                  <button
                    key={s}
                    onClick={() => changeStage(s)}
                    disabled={stageSaving}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
                      current ? `${STAGE_CHIP[s]} ring-2 ring-offset-1 ring-current` :
                      past ? "bg-gray-100 text-gray-400" :
                      "bg-gray-50 text-gray-400 hover:bg-gray-100"
                    }`}
                  >
                    {STAGE_LABELS[s]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Info card — Résumé tab */}
          {leftTab === "resume" && <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-900">Informations</h2>
            </div>
            {deal.deal_date && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Date de demande</span>
                <span className="text-gray-700">{formatDate(deal.deal_date)}</span>
              </div>
            )}
            {deal.country && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Pays</span>
                <span className="text-gray-700">{deal.country}</span>
              </div>
            )}
            {deal.source && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Source</span>
                <span className="flex items-center gap-1.5 text-gray-700">
                  {SOURCE_ICON[deal.source]}
                  {SOURCE_LABELS[deal.source] ?? deal.source}
                  {deal.source_detail && <span className="text-gray-400 text-xs">— {deal.source_detail}</span>}
                </span>
              </div>
            )}
            {deal.preferred_channel && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Canal préféré</span>
                <span className="text-gray-700 capitalize">{deal.preferred_channel === "phone" ? "Téléphone" : deal.preferred_channel === "email" ? "Email" : "WhatsApp"}</span>
              </div>
            )}
            {deal.original_request && (
              <div className="flex gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Demande originale</span>
                <span className="text-gray-700 whitespace-pre-line">{deal.original_request}</span>
              </div>
            )}
            {deal.products_requested && (
              <div className="flex gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Produits demandés</span>
                <span className="text-gray-700">{deal.products_requested}</span>
              </div>
            )}
            {(deal.sector && deal.sector.length > 0) && (
              <div className="flex gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Secteur</span>
                <div className="flex flex-wrap gap-1">
                  {deal.sector.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {/* Contact principal */}
            {(deal.contact_name || deal.contact_email || deal.contact_phone) && (
              <div className="flex gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Contact</span>
                <div className="space-y-0.5">
                  {deal.contact_name && <p className="text-gray-900 font-medium">{deal.contact_name}{deal.contact_role && <span className="text-gray-400 font-normal ml-1">— {deal.contact_role}</span>}</p>}
                  {deal.contact_email && <a href={`mailto:${deal.contact_email}`} className="text-blue-600 hover:underline block text-xs">{deal.contact_email}</a>}
                  {deal.contact_phone && <a href={`https://wa.me/${deal.contact_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline block text-xs">{deal.contact_phone}</a>}
                </div>
              </div>
            )}
            {showValue && deal.value && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Valeur estimée</span>
                <span className="font-semibold text-blue-600">{formatCurrency(deal.value, deal.currency as "USD" | "GNF" | "EUR")}</span>
              </div>
            )}
            {showValue && (deal.selling_price != null || deal.cost != null) && (() => {
              const margin = (deal.selling_price ?? 0) - (deal.cost ?? 0)
              const marginPct = deal.selling_price ? (margin / deal.selling_price) * 100 : null
              return (
                <>
                  {deal.selling_price != null && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Prix de vente</span>
                      <span className="font-medium text-gray-800">{formatCurrency(deal.selling_price, deal.currency as "USD" | "GNF" | "EUR")}</span>
                    </div>
                  )}
                  {deal.cost != null && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Coût</span>
                      <span className="font-medium text-gray-800">{formatCurrency(deal.cost, deal.currency as "USD" | "GNF" | "EUR")}</span>
                    </div>
                  )}
                  {deal.selling_price != null && deal.cost != null && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Marge</span>
                      <span className={`font-semibold ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(margin, deal.currency as "USD" | "GNF" | "EUR")}
                        {marginPct != null && (
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${margin >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                            {marginPct.toFixed(1)}%
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </>
              )
            })()}
            {deal.next_action && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Prochaine action</span>
                <span className="text-gray-700">{deal.next_action}
                  {deal.next_action_date && <span className="ml-1 text-gray-400">({formatDate(deal.next_action_date)})</span>}
                </span>
              </div>
            )}
            {deal.notes && (
              <div className="flex gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Notes</span>
                <span className="text-gray-700 whitespace-pre-line">{deal.notes}</span>
              </div>
            )}
          </div>}

          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {([
              { key: "resume", label: "Résumé" },
              { key: "activite", label: "Activité" },
              { key: "finances", label: "Finances", icon: <TrendingUp className="w-3.5 h-3.5" /> },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setLeftTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition ${
                  leftTab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {"icon" in t && t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Finances tab */}
          {leftTab === "finances" && (
            <DealFinancialsPanel
              dealId={deal.id}
              dealCurrency={deal.currency}
              invoiceFromProps={deal.invoice ? {
                id: deal.invoice.id,
                number: deal.invoice.number,
                status: deal.invoice.status,
                total_ht: deal.invoice.total_ht ?? 0,
                total_ttc: 0,
                total_paid: 0,
                currency: deal.invoice.currency,
              } : null}
            />
          )}

          {/* Activity journal */}
          {leftTab === "activite" && <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-yellow-500" /> Journal d'activité</h2>
              <button
                onClick={() => setActivityModal(true)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Détaillé
              </button>
            </div>

            {/* Quick actions */}
            <div className="px-4 py-3 border-b border-gray-50 space-y-2">
              <div className="flex gap-2 flex-wrap">
                {QUICK_ACTIONS.map(qa => (
                  <button
                    key={qa.type}
                    onClick={() => setQuickType(quickType === qa.type ? null : qa.type)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${quickType === qa.type ? "ring-2 ring-offset-1 ring-blue-400 " : ""}${qa.color}`}
                  >
                    {qa.icon} {qa.label}
                  </button>
                ))}
              </div>
              {quickType && (
                <div className="flex gap-2 items-center">
                  <input
                    autoFocus
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                    placeholder="Note optionnelle…"
                    value={quickNote}
                    onChange={e => setQuickNote(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") quickLog(quickType) }}
                  />
                  <button
                    onClick={() => quickLog(quickType)}
                    disabled={quickSaving}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {quickSaving ? "…" : "Logger"}
                  </button>
                  <button onClick={() => { setQuickType(null); setQuickNote("") }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                </div>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {activities.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Aucune activité enregistrée</p>
                </div>
              ) : activities.map(act => {
                const logger = profiles.find(p => p.id === act.user_id)
                const loggerName = logger ? (logger.full_name ?? logger.email) : null
                return (
                <div key={act.id} className="group flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="mt-0.5 flex-shrink-0">
                    {ACTIVITY_TYPE_ICON[act.type] ?? <FileText className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingActId === act.id ? (
                      <div className="space-y-2">
                        <select
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
                          value={editActForm.type}
                          onChange={e => setEditActForm(f => ({ ...f, type: e.target.value }))}
                        >
                          {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <input
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                          value={editActForm.subject}
                          onChange={e => setEditActForm(f => ({ ...f, subject: e.target.value }))}
                          placeholder="Sujet"
                        />
                        <textarea
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-400 resize-none"
                          rows={2}
                          value={editActForm.notes}
                          onChange={e => setEditActForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Note…"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveEditAct}
                            disabled={editActSaving}
                            className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40"
                          >
                            {editActSaving ? "…" : "Enregistrer"}
                          </button>
                          <button
                            onClick={() => setEditingActId(null)}
                            className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 rounded-lg border border-gray-200"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{act.subject}</span>
                          {act.completed && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEditAct(act)}
                              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition"
                              title="Modifier"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => deleteActivity(act.id)}
                              className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {act.notes && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{act.notes}</p>}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDateTime(act.date)}
                          </span>
                          {loggerName && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <User className="w-3 h-3" /> {loggerName}
                            </span>
                          )}
                          {act.follow_up_date && (
                            <span className="text-xs text-orange-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Relance : {formatDate(act.follow_up_date)}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          </div>}
        </div>

        {/* Right col */}
        <div className="space-y-5">
          {/* Assignment */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Assignation</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400 text-xs w-20">Responsable</span>
              <span className="text-gray-700">
                {deal.assignedEmployees?.length > 0
                  ? deal.assignedEmployees.map(e => e.full_name ?? e.email).join(", ")
                  : "Non assigné"}
              </span>
            </div>
            {deal.account && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 text-xs w-20">Compte</span>
                  <span className="text-gray-700">{deal.account.name}</span>
                </div>
                {(deal.account as any).email && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 text-xs w-20">Email</span>
                    <a href={`mailto:${(deal.account as any).email}`} className="text-blue-600 hover:underline truncate">{(deal.account as any).email}</a>
                  </div>
                )}
                {(deal.account as any).phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 text-xs w-20">Téléphone</span>
                    <a
                      href={`https://wa.me/${(deal.account as any).phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline"
                    >{(deal.account as any).phone}</a>
                  </div>
                )}
                {(deal.account as any).country && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 text-xs w-20">Pays</span>
                    <span className="text-gray-700">{(deal.account as any).country}</span>
                  </div>
                )}
              </>
            )}
            {deal.prospect_name && !deal.account && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 text-xs w-20">Prospect</span>
                <span className="text-gray-700">{deal.prospect_name}</span>
              </div>
            )}
          </div>

          {/* Devis liés */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-500" /> Devis liés
                {linkedDevis.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">{linkedDevis.length}</span>
                )}
              </h2>
              <button
                onClick={() => { setDevisPickerOpen(true); searchDevis("") }}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Lier
              </button>
            </div>

            {linkedDevis.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs">Aucun devis lié</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {linkedDevis.map(d => (
                  <div key={d.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <a
                        href={`/fr/ventes/devis/${d.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline font-mono"
                      >
                        {d.number}
                      </a>
                      {d.account && <p className="text-xs text-gray-400">{d.account.name}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {d.total_ttc != null && (
                        <p className="text-xs font-medium text-gray-700">
                          {formatCurrency(d.total_ttc, (d.currency === "XOF" ? "EUR" : d.currency) as "USD" | "GNF" | "EUR")}
                        </p>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        d.status === "confirmed" ? "bg-green-50 text-green-600" :
                        d.status === "draft" ? "bg-gray-100 text-gray-500" :
                        d.status === "invoiced" ? "bg-blue-50 text-blue-600" :
                        "bg-red-50 text-red-500"
                      }`}>
                        {d.status === "draft" ? "Brouillon" : d.status === "confirmed" ? "Confirmé" : d.status === "invoiced" ? "Facturé" : "Annulé"}
                      </span>
                    </div>
                    <button
                      onClick={() => unlinkDevis(d.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition"
                      title="Dissocier"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Facture liée (deals "won") */}
          {deal.stage === "won" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-green-500" /> Facture liée
                </h2>
                {!linkedInvoice && (
                  <button
                    onClick={() => setInvoicePickerOpen(true)}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Lier
                  </button>
                )}
              </div>
              {linkedInvoice ? (
                <div className="group flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <a href={`/fr/ventes/factures/${linkedInvoice.id}`} className="text-sm font-medium text-blue-600 hover:underline font-mono">
                      {linkedInvoice.number}
                    </a>
                    {linkedInvoice.total_ht != null && (
                      <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(linkedInvoice.total_ht, linkedInvoice.currency as "USD" | "GNF" | "EUR")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      linkedInvoice.status === "paid" ? "bg-green-50 text-green-600" :
                      linkedInvoice.status === "draft" ? "bg-gray-100 text-gray-500" :
                      linkedInvoice.status === "sent" ? "bg-blue-50 text-blue-600" :
                      "bg-red-50 text-red-500"
                    }`}>
                      {linkedInvoice.status === "draft" ? "Brouillon" : linkedInvoice.status === "sent" ? "Envoyée" : linkedInvoice.status === "paid" ? "Payée" : linkedInvoice.status}
                    </span>
                    <button
                      onClick={unlinkInvoice}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition"
                      title="Dissocier"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 text-xs">Aucune facture liée</div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Invoice picker modal */}
      {invoicePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setInvoicePickerOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">Lier une facture</h2>
              <button onClick={() => setInvoicePickerOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-3">
              <input
                autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Rechercher une facture (ex: FAC-2025)…"
                value={invoiceSearch}
                onChange={e => searchInvoices(e.target.value)}
              />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 pb-2">
              {invoiceResults.length === 0 && invoiceSearch.length < 2 && (
                <p className="text-xs text-gray-400 text-center py-6">Tapez pour chercher une facture</p>
              )}
              {invoiceResults.length === 0 && invoiceSearch.length >= 2 && (
                <p className="text-xs text-gray-400 text-center py-6">Aucun résultat</p>
              )}
              {invoiceResults.map(inv => (
                <button
                  key={inv.id}
                  onClick={() => linkInvoice(inv.id)}
                  disabled={invoiceLinking}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition text-left disabled:opacity-40"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 font-mono">{inv.number}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {inv.total_ht != null && (
                      <p className="text-xs font-medium text-gray-600">{formatCurrency(inv.total_ht, inv.currency as "USD" | "GNF" | "EUR")}</p>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${inv.status === "paid" ? "bg-green-50 text-green-600" : inv.status === "sent" ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                      {inv.status === "draft" ? "Brouillon" : inv.status === "sent" ? "Envoyée" : inv.status === "paid" ? "Payée" : inv.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Devis picker modal */}
      {devisPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setDevisPickerOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">Lier un devis</h2>
              <button onClick={() => setDevisPickerOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-3">
              <input
                autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Rechercher un devis (ex: DEV-2025)…"
                value={devisSearch}
                onChange={e => searchDevis(e.target.value)}
              />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 pb-2">
              {devisResults.length === 0 && devisSearch.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">Tapez pour chercher un devis</p>
              )}
              {devisResults.length === 0 && devisSearch.length > 0 && (
                <p className="text-xs text-gray-400 text-center py-6">Aucun résultat</p>
              )}
              {devisResults.map(d => (
                <button
                  key={d.id}
                  onClick={() => linkDevis(d.id)}
                  disabled={devisLinking}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition text-left disabled:opacity-40"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 font-mono">{d.number}</p>
                    {d.account && <p className="text-xs text-gray-400">{d.account.name}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {d.total_ttc != null && (
                      <p className="text-xs font-medium text-gray-600">
                        {formatCurrency(d.total_ttc, (d.currency === "XOF" ? "EUR" : d.currency) as "USD" | "GNF" | "EUR")}
                      </p>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      d.status === "confirmed" ? "bg-green-50 text-green-600" :
                      d.status === "draft" ? "bg-gray-100 text-gray-500" :
                      "bg-blue-50 text-blue-600"
                    }`}>
                      {d.status === "draft" ? "Brouillon" : d.status === "confirmed" ? "Confirmé" : "Facturé"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setEditing(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-semibold text-gray-900">Modifier la demande</h2>
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Titre</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Date de demande</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={editForm.deal_date} onChange={e => setEditForm(f => ({ ...f, deal_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Pays</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Ex: Guinée…" value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Demande originale</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" rows={4} value={editForm.original_request} onChange={e => setEditForm(f => ({ ...f, original_request: e.target.value }))} placeholder="Demande originale du client…" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Produits / services demandés</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" rows={3} value={editForm.products_requested} onChange={e => setEditForm(f => ({ ...f, products_requested: e.target.value }))} />
              </div>
              {/* Contact principal */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Contact principal</label>
                <div className="grid grid-cols-2 gap-2">
                  <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Nom" value={editForm.contact_name} onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))} />
                  <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Fonction" value={editForm.contact_role} onChange={e => setEditForm(f => ({ ...f, contact_role: e.target.value }))} />
                  <input type="email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Email" value={editForm.contact_email} onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))} />
                  <input type="tel" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Téléphone" value={editForm.contact_phone} onChange={e => setEditForm(f => ({ ...f, contact_phone: e.target.value }))} />
                </div>
              </div>
              {/* Secteur */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Secteur d&apos;activité</label>
                <div className="flex flex-wrap gap-2">
                  {["Mines", "Construction", "Transport", "Industrie", "Agriculture", "Marine", "Gouvernement", "Autre"].map(s => (
                    <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.sector.includes(s)}
                        onChange={e => setEditForm(f => ({ ...f, sector: e.target.checked ? [...f.sector, s] : f.sector.filter(x => x !== s) }))}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Canal préféré */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Canal préféré</label>
                <div className="flex gap-2">
                  {[{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }, { value: "phone", label: "Téléphone" }].map(ch => (
                    <button
                      key={ch.value}
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, preferred_channel: f.preferred_channel === ch.value ? "" : ch.value }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${editForm.preferred_channel === ch.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Assigné à</label>
                  <div className="border border-gray-200 rounded-lg p-2 space-y-1 max-h-36 overflow-y-auto">
                    {profiles.map(p => (
                      <label key={p.id} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.assigned_to.includes(p.id)}
                          onChange={e => setEditForm(f => ({
                            ...f,
                            assigned_to: e.target.checked
                              ? [...f.assigned_to, p.id]
                              : f.assigned_to.filter(id => id !== p.id),
                          }))}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">{p.full_name ?? p.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Priorité</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="normal">Normal</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
              </div>
              {showValue && (() => {
                const sp = parseFloat(editForm.selling_price) || 0
                const cost = parseFloat(editForm.cost) || 0
                const margin = sp - cost
                const marginPct = sp > 0 ? (margin / sp) * 100 : null
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Valeur estimée</label>
                        <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={editForm.value} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Devise</label>
                        <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={editForm.currency} onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))}>
                          <option>USD</option><option>GNF</option><option>EUR</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Prix de vente</label>
                        <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="0" value={editForm.selling_price} onChange={e => setEditForm(f => ({ ...f, selling_price: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Coût</label>
                        <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="0" value={editForm.cost} onChange={e => setEditForm(f => ({ ...f, cost: e.target.value }))} />
                      </div>
                    </div>
                    {(editForm.selling_price || editForm.cost) && (
                      <div className={`rounded-lg px-3 py-2 text-sm flex items-center gap-2 ${margin >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        <span className="text-xs font-medium">Marge :</span>
                        <span className="font-semibold">{margin.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {editForm.currency}</span>
                        {marginPct != null && (
                          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${margin >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {marginPct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Prochaine action</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Ex: Envoyer le devis, Rappeler M. Diallo…" value={editForm.next_action} onChange={e => setEditForm(f => ({ ...f, next_action: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Date de la prochaine action</label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={editForm.next_action_date} onChange={e => setEditForm(f => ({ ...f, next_action_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Notes internes</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" rows={3} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
              {saveError && <p className="text-sm text-red-600 mb-3">{saveError}</p>}
              <div className="flex justify-end gap-2">
              <button onClick={() => { setEditing(false); setSaveError(null) }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition">Annuler</button>
              <button onClick={saveEdit} disabled={saving} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity modal */}
      {activityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setActivityModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Ajouter une activité</h2>
              <button onClick={() => setActivityModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Source</label>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setActForm(f => ({ ...f, type: t.value }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${actForm.type === t.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Sujet *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Ex: Appel de suivi, Envoi devis…" value={actForm.subject} onChange={e => setActForm(f => ({ ...f, subject: e.target.value }))} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Notes</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" rows={3} placeholder="Détails, compte-rendu…" value={actForm.notes} onChange={e => setActForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Date</label>
                  <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={actForm.date} onChange={e => setActForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Date de relance</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={actForm.follow_up_date} onChange={e => setActForm(f => ({ ...f, follow_up_date: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setActivityModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition">Annuler</button>
              <button onClick={addActivity} disabled={!actForm.subject.trim() || actSaving} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition">
                {actSaving ? "Ajout…" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
