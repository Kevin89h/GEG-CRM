"use client"

import { useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Plus, Phone, Video, Mail, FileText, CalendarCheck, Check, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import type { Activity, ActivityType } from "@/types"

type ActivityFull = Activity & {
  account: { id: string; name: string } | null
  deal: { id: string; title: string } | null
  contact: { id: string; first_name: string; last_name: string } | null
}

interface Props {
  activities: ActivityFull[]
  accounts: { id: string; name: string }[]
  deals: { id: string; title: string }[]
  currentUserId: string
}

const typeIcon: Record<ActivityType, React.ElementType> = {
  call: Phone,
  meeting: Video,
  email: Mail,
  note: FileText,
}

const typeColor: Record<ActivityType, "blue" | "purple" | "yellow" | "gray"> = {
  call: "blue",
  meeting: "purple",
  email: "yellow",
  note: "gray",
}

const EMPTY_FORM = (userId: string) => ({
  type: "call" as ActivityType,
  subject: "",
  notes: "",
  date: new Date().toISOString().slice(0, 16),
  follow_up_date: "",
  completed: false,
  account_id: "",
  deal_id: "",
  user_id: userId,
})

export default function ActivitiesClient({ activities: initial, accounts, deals, currentUserId }: Props) {
  const t = useTranslations("activities")
  const [activities, setActivities] = useState(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [editActivity, setEditActivity] = useState<ActivityFull | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM(currentUserId))

  function openEdit(a: ActivityFull) {
    setEditActivity(a)
    setForm({
      type: a.type,
      subject: a.subject,
      notes: a.notes ?? "",
      date: a.date ? a.date.slice(0, 16) : new Date().toISOString().slice(0, 16),
      follow_up_date: a.follow_up_date ?? "",
      completed: a.completed,
      account_id: a.account?.id ?? "",
      deal_id: a.deal?.id ?? "",
      user_id: currentUserId,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditActivity(null)
    setForm(EMPTY_FORM(currentUserId))
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        ...form,
        account_id: form.account_id || null,
        deal_id: form.deal_id || null,
        follow_up_date: form.follow_up_date || null,
      }
      const res = editActivity
        ? await fetch(`/api/activities/${editActivity.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/activities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error ?? "Erreur"); setSaving(false); return }
      if (editActivity) {
        setActivities(prev => prev.map(a => a.id === editActivity.id ? { ...a, ...payload, account: accounts.find(ac => ac.id === payload.account_id) ?? null, deal: deals.find(d => d.id === payload.deal_id) ?? null } : a))
      } else {
        setActivities(prev => [data, ...prev])
      }
      closeModal()
    } catch {
      setSaveError("Erreur réseau, veuillez réessayer")
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette activité ?")) return
    setActivities(prev => prev.filter(a => a.id !== id))
    const res = await fetch(`/api/activities/${id}`, { method: "DELETE" })
    if (!res.ok) {
      // refetch on failure — reload page as fallback
      window.location.reload()
    }
  }

  async function toggleComplete(id: string, completed: boolean) {
    // Optimistic update
    setActivities(prev => prev.map(a => a.id === id ? { ...a, completed: !completed } : a))
    const res = await fetch(`/api/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !completed }),
    })
    if (!res.ok) {
      // Roll back on failure
      setActivities(prev => prev.map(a => a.id === id ? { ...a, completed } : a))
    }
  }

  const upcoming = activities.filter(a => !a.completed && a.follow_up_date)
  const rest = activities.filter(a => !upcoming.includes(a))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{activities.length} activité{activities.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          {t("new")}
        </Button>
      </div>

      {/* Upcoming follow-ups */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-amber-500" />
            Suivis à effectuer
          </h2>
          <div className="space-y-2">
            {upcoming.map(a => <ActivityRow key={a.id} activity={a} t={t} onToggle={toggleComplete} onEdit={openEdit} onDelete={handleDelete} highlight />)}
          </div>
        </div>
      )}

      {/* All activities */}
      <div className="space-y-2">
        {rest.length === 0 && upcoming.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CalendarCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>{t("noActivities")}</p>
          </div>
        ) : (
          rest.map(a => <ActivityRow key={a.id} activity={a} t={t} onToggle={toggleComplete} onEdit={openEdit} onDelete={handleDelete} />)
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editActivity ? "Modifier l'activité" : t("newActivity")}>
        <div className="space-y-4">
          <Select
            label={t("type")}
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as ActivityType }))}
            options={["call", "meeting", "email", "note"].map(v => ({ value: v, label: t(v as ActivityType) }))}
          />
          <Input
            label={t("subject")}
            value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            required
          />
          <Input
            label={t("date")}
            type="datetime-local"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
          <Select
            label={t("account")}
            value={form.account_id}
            onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
            options={[{ value: "", label: "— Aucun —" }, ...accounts.map(a => ({ value: a.id, label: a.name }))]}
          />
          <Select
            label={t("deal")}
            value={form.deal_id}
            onChange={e => setForm(f => ({ ...f, deal_id: e.target.value }))}
            options={[{ value: "", label: "— Aucune —" }, ...deals.map(d => ({ value: d.id, label: d.title }))]}
          />
          <Input
            label={t("followUp")}
            type="date"
            value={form.follow_up_date}
            onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("notes")}</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.subject || saving}>{t("save")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ActivityRow({
  activity: a,
  t,
  onToggle,
  onEdit,
  onDelete,
  highlight = false,
}: {
  activity: ActivityFull
  t: ReturnType<typeof useTranslations<"activities">>
  onToggle: (id: string, completed: boolean) => void
  onEdit: (a: ActivityFull) => void
  onDelete: (id: string) => void
  highlight?: boolean
}) {
  const Icon = typeIcon[a.type]
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [menuOpen])

  return (
    <div className={`flex items-start gap-3 bg-white rounded-xl border p-4 transition-shadow hover:shadow-sm ${highlight ? "border-amber-200 bg-amber-50/30" : "border-gray-100"} ${a.completed ? "opacity-60" : ""}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.completed ? "bg-gray-100" : "bg-blue-50"}`}>
        <Icon className={`w-4 h-4 ${a.completed ? "text-gray-400" : "text-blue-600"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-medium text-sm ${a.completed ? "line-through text-gray-400" : "text-gray-900"}`}>
            {a.subject}
          </p>
          <Badge variant={typeColor[a.type]}>{t(a.type)}</Badge>
        </div>
        <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
          <span>{new Date(a.date).toLocaleString("fr", { dateStyle: "medium", timeStyle: "short" })}</span>
          {a.account && <span>• {a.account.name}</span>}
          {a.deal && <span>• {a.deal.title}</span>}
          {a.follow_up_date && (
            <span className="text-amber-600">• Suivi: {new Date(a.follow_up_date).toLocaleDateString("fr")}</span>
          )}
        </div>
        {a.notes && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{a.notes}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onToggle(a.id, a.completed)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${a.completed ? "bg-emerald-500 border-emerald-500" : "border-gray-300 hover:border-emerald-500"}`}
        >
          {a.completed && <Check className="w-3 h-3 text-white" />}
        </button>

        {/* 3-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-20 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1">
              <button
                onClick={() => { setMenuOpen(false); onEdit(a) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="w-3.5 h-3.5" />
                Modifier
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete(a.id) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
