"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, TrendingUp, LayoutGrid, List, MessageSquare, Mail, Phone, Users, Globe, HelpCircle, AlertCircle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { DealStage } from "@/types"

interface DealRow {
  id: string
  title: string
  stage: DealStage
  value: number | null
  currency: string
  probability: number | null
  priority: string
  source: string | null
  assigned_to: string[] | null
  prospect_name: string | null
  products_requested: string | null
  account: { id: string; name: string } | null
}

interface UserProfile {
  id: string
  full_name: string | null
  email: string
}

interface Props {
  deals: DealRow[]
  accounts: { id: string; name: string }[]
  profiles: UserProfile[]
  currentUserId: string
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

const STAGE_BORDER: Record<DealStage, string> = {
  lead: "border-t-gray-400",
  qualified: "border-t-blue-500",
  proposal: "border-t-yellow-500",
  negotiation: "border-t-purple-500",
  won: "border-t-green-500",
  lost: "border-t-red-500",
}

const SOURCE_ICON: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="w-3 h-3 text-green-600" />,
  email: <Mail className="w-3 h-3 text-blue-600" />,
  phone: <Phone className="w-3 h-3 text-orange-500" />,
  referral: <Users className="w-3 h-3 text-purple-600" />,
  website: <Globe className="w-3 h-3 text-sky-500" />,
  other: <HelpCircle className="w-3 h-3 text-gray-400" />,
}

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  phone: "Téléphone",
  referral: "Référence",
  website: "Site web",
  other: "Autre",
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

function EmptyColumn() {
  return (
    <div className="border-2 border-dashed border-gray-100 rounded-xl p-3 text-center text-xs text-gray-300">—</div>
  )
}

export default function DealsClient({ deals: initial, accounts, profiles, currentUserId }: Props) {
  const router = useRouter()
  const [deals, setDeals] = useState(initial)
  const [view, setView] = useState<"kanban" | "list">("kanban")
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [clientType, setClientType] = useState<"existing" | "new">("existing")
  const [form, setForm] = useState({
    title: "",
    account_id: "",
    prospect_name: "",
    stage: "lead" as DealStage,
    source: "whatsapp",
    source_detail: "",
    products_requested: "",
    assigned_to: [] as string[],
    priority: "normal",
    value: "",
    currency: "USD",
  })

  function f<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  function resetForm() {
    setForm({ title: "", account_id: "", prospect_name: "", stage: "lead", source: "whatsapp", source_detail: "", products_requested: "", assigned_to: [], priority: "normal", value: "", currency: "USD" })
    setClientType("existing")
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    setSaveError(null)
    const body = {
      title: form.title,
      account_id: clientType === "existing" && form.account_id ? form.account_id : null,
      prospect_name: clientType === "new" ? form.prospect_name || null : null,
      stage: form.stage,
      source: form.source,
      source_detail: form.source_detail || null,
      products_requested: form.products_requested || null,
      assigned_to: form.assigned_to.length > 0 ? form.assigned_to : null,
      priority: form.priority,
      value: form.value ? parseFloat(form.value) : null,
      currency: form.currency,
    }
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok) {
      setDeals(prev => [data, ...prev])
      setModalOpen(false)
      resetForm()
    } else {
      setSaveError(data.error ?? "Erreur lors de la création")
    }
    setSaving(false)
  }

  const totalPipeline = deals
    .filter(d => !["won", "lost"].includes(d.stage))
    .reduce((s, d) => s + (d.value ?? 0), 0)

  const urgentCount = deals.filter(d => d.priority === "urgent" && !["won", "lost"].includes(d.stage)).length

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Pipeline commercial</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-gray-500 text-sm">Pipeline actif : {formatCurrency(totalPipeline, "USD")}</p>
            {urgentCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3" /> {urgentCount} urgent{urgentCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 transition ${view === "kanban" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <LayoutGrid className="w-4 h-4" /> Kanban
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 transition ${view === "list" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <List className="w-4 h-4" /> Liste
            </button>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" /> Nouvelle demande
          </button>
        </div>
      </div>

      {/* Kanban */}
      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage)
            const stageValue = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0)
            return (
              <div key={stage} className={`flex-shrink-0 w-60 bg-gray-50 rounded-xl border border-gray-100 border-t-4 ${STAGE_BORDER[stage]}`}>
                <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STAGE_CHIP[stage]}`}>{STAGE_LABELS[stage]}</span>
                    <span className="text-xs text-gray-400">{stageDeals.length}</span>
                  </div>
                  {stageValue > 0 && (
                    <span className="text-xs text-gray-500 font-medium">{formatCurrency(stageValue, "USD")}</span>
                  )}
                </div>
                <div className="px-2 pb-2 space-y-2 min-h-16">
                  {stageDeals.map(deal => {
                    const assignedEmps = profiles.filter(p => Array.isArray(deal.assigned_to) && deal.assigned_to.includes(p.id))
                    const clientName = deal.account?.name ?? deal.prospect_name ?? null
                    return (
                      <button
                        key={deal.id}
                        onClick={() => router.push(`deals/${deal.id}`)}
                        className={`w-full text-left bg-white rounded-xl border shadow-sm p-3 hover:shadow-md transition-shadow ${deal.priority === "urgent" ? "border-red-200" : "border-gray-100"}`}
                      >
                        {deal.priority === "urgent" && (
                          <div className="flex items-center gap-1 text-red-600 text-xs font-medium mb-1.5">
                            <AlertCircle className="w-3 h-3" /> Urgent
                          </div>
                        )}
                        <p className="font-semibold text-gray-900 text-sm leading-tight">{deal.title}</p>
                        {clientName && <p className="text-xs text-gray-500 mt-0.5">{clientName}</p>}
                        {deal.products_requested && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{deal.products_requested}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          {deal.source && SOURCE_ICON[deal.source] ? (
                            <span className="flex items-center gap-0.5 text-xs text-gray-400">
                              {SOURCE_ICON[deal.source]}
                              <span className="ml-0.5">{SOURCE_LABELS[deal.source] ?? deal.source}</span>
                            </span>
                          ) : <span />}
                          <div className="flex items-center gap-1.5">
                            {deal.value ? (
                              <span className="text-xs font-semibold text-blue-600">{formatCurrency(deal.value, deal.currency as "USD" | "GNF" | "EUR")}</span>
                            ) : null}
                            {assignedEmps.map(p => (
                              <span key={p.id} className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                {initials(p.full_name ?? p.email)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  {stageDeals.length === 0 && <EmptyColumn />}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List view */
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {deals.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Aucune demande enregistrée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-left">
                    <th className="px-4 py-3 font-medium text-gray-600">Demande</th>
                    <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Client</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Étape</th>
                    <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Source</th>
                    <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Assigné</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Valeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {deals.map(deal => {
                    const assignedEmps = profiles.filter(p => Array.isArray(deal.assigned_to) && deal.assigned_to.includes(p.id))
                    const clientName = deal.account?.name ?? deal.prospect_name ?? "—"
                    return (
                      <tr
                        key={deal.id}
                        onClick={() => router.push(`deals/${deal.id}`)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {deal.priority === "urgent" && <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                            <span className="font-medium text-gray-900">{deal.title}</span>
                          </div>
                          {deal.products_requested && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{deal.products_requested}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{clientName}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_CHIP[deal.stage]}`}>{STAGE_LABELS[deal.stage]}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {deal.source && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              {SOURCE_ICON[deal.source]}
                              {SOURCE_LABELS[deal.source] ?? deal.source}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">
                          {assignedEmps.length > 0 ? assignedEmps.map(p => p.full_name ?? p.email).join(", ") : "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-blue-600">
                          {deal.value ? formatCurrency(deal.value, deal.currency as "USD" | "GNF" | "EUR") : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal nouvelle demande */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => { setModalOpen(false); resetForm() }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-semibold text-gray-900">Nouvelle demande</h2>
              <button onClick={() => { setModalOpen(false); resetForm() }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">

              {/* Source */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Source</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(SOURCE_LABELS).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => f("source", val)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        form.source === val ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      {SOURCE_ICON[val]} {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Objet de la demande *</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Ex: Demande transpalettes électriques, Offre équipements…"
                  value={form.title}
                  onChange={e => f("title", e.target.value)}
                  autoFocus
                />
              </div>

              {/* Products requested */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Produits / services demandés</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Ex: 2x Transpalette 2T, 1x Chariot élévateur 3T, livraison incluse…"
                  rows={3}
                  value={form.products_requested}
                  onChange={e => f("products_requested", e.target.value)}
                />
              </div>

              {/* Source detail */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Contexte / détail</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Ex: Message reçu le 15/07 de M. Diallo — besoin urgent avant fin de mois"
                  value={form.source_detail}
                  onChange={e => f("source_detail", e.target.value)}
                />
              </div>

              {/* Client */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Client</label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setClientType("existing")}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${clientType === "existing" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}
                  >
                    Compte existant
                  </button>
                  <button
                    onClick={() => setClientType("new")}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${clientType === "new" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}
                  >
                    Nouveau prospect
                  </button>
                </div>
                {clientType === "existing" ? (
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={form.account_id}
                    onChange={e => f("account_id", e.target.value)}
                  >
                    <option value="">— Sélectionner un compte</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                ) : (
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Nom du prospect ou de la société"
                    value={form.prospect_name}
                    onChange={e => f("prospect_name", e.target.value)}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Assigné à</label>
                  <div className="border border-gray-200 rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                    {profiles.map(p => (
                      <label key={p.id} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.assigned_to.includes(p.id)}
                          onChange={e => setForm(prev => ({
                            ...prev,
                            assigned_to: e.target.checked
                              ? [...prev.assigned_to, p.id]
                              : prev.assigned_to.filter(id => id !== p.id),
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
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={form.priority}
                    onChange={e => f("priority", e.target.value)}
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Valeur estimée</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="0"
                    value={form.value}
                    onChange={e => f("value", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Devise</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={form.currency}
                    onChange={e => f("currency", e.target.value)}
                  >
                    <option>USD</option>
                    <option>GNF</option>
                    <option>EUR</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
              {saveError && (
                <p className="text-sm text-red-600 mb-3">{saveError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setModalOpen(false); resetForm(); setSaveError(null) }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition">Annuler</button>
                <button
                  onClick={handleSave}
                  disabled={!form.title.trim() || saving}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition"
                >
                  {saving ? "Création…" : "Créer la demande"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
