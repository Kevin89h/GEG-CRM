"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, MessageSquare, Mail, Phone, Users, Globe, HelpCircle,
  AlertCircle, CheckCircle2, Clock, PhoneCall, FileText, StickyNote,
  Edit2, Plus, Calendar, User
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { DealStage } from "@/types"

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
}

interface UserProfile {
  id: string
  full_name: string | null
  email: string
}

interface Props {
  deal: Deal
  activities: Activity[]
  profiles: UserProfile[]
  accounts: { id: string; name: string }[]
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
}

const ACTIVITY_TYPES = [
  { value: "note", label: "Note", icon: <StickyNote className="w-4 h-4" /> },
  { value: "call", label: "Appel", icon: <PhoneCall className="w-4 h-4" /> },
  { value: "email", label: "Email", icon: <Mail className="w-4 h-4" /> },
  { value: "meeting", label: "Réunion", icon: <Users className="w-4 h-4" /> },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function DealDetailClient({ deal: initial, activities: initialActs, profiles, accounts }: Props) {
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
  })
  const [activityModal, setActivityModal] = useState(false)
  const [actForm, setActForm] = useState({ type: "note", subject: "", notes: "", date: new Date().toISOString().slice(0, 16), follow_up_date: "" })
  const [actSaving, setActSaving] = useState(false)

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

  async function saveEdit() {
    setSaveError(null)
    setSaving(true)
    const body = {
      title: editForm.title,
      products_requested: editForm.products_requested || null,
      notes: editForm.notes || null,
      next_action: editForm.next_action || null,
      next_action_date: editForm.next_action_date || null,
      assigned_to: editForm.assigned_to,
      priority: editForm.priority,
      value: editForm.value ? parseFloat(editForm.value) : null,
      currency: editForm.currency,
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
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition flex-shrink-0">
          <Edit2 className="w-3.5 h-3.5" /> Modifier
        </button>
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

          {/* Info card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-900">Informations</h2>
            </div>
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
            {deal.products_requested && (
              <div className="flex gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Produits demandés</span>
                <span className="text-gray-700">{deal.products_requested}</span>
              </div>
            )}
            {deal.value && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Valeur estimée</span>
                <span className="font-semibold text-blue-600">{formatCurrency(deal.value, deal.currency as "USD" | "GNF" | "EUR")}</span>
              </div>
            )}
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
          </div>

          {/* Activity journal */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Journal d'activité</h2>
              <button
                onClick={() => setActivityModal(true)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
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
                <div key={act.id} className="flex gap-3 px-4 py-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {ACTIVITY_TYPE_ICON[act.type] ?? <FileText className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{act.subject}</span>
                      {act.completed && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
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
                  </div>
                </div>
                )
              })}
            </div>
          </div>
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
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 text-xs w-20">Compte</span>
                <span className="text-gray-700">{deal.account.name}</span>
              </div>
            )}
            {deal.prospect_name && !deal.account && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 text-xs w-20">Prospect</span>
                <span className="text-gray-700">{deal.prospect_name}</span>
              </div>
            )}
          </div>

        </div>
      </div>

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
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Produits / services demandés</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" rows={3} value={editForm.products_requested} onChange={e => setEditForm(f => ({ ...f, products_requested: e.target.value }))} />
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Valeur</label>
                  <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={editForm.value} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Devise</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={editForm.currency} onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))}>
                    <option>USD</option><option>GNF</option><option>EUR</option>
                  </select>
                </div>
              </div>
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
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Type</label>
                <div className="flex gap-2">
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
