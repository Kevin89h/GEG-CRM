"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Plus, Phone, Video, Mail, FileText, CalendarCheck, Check } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
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

export default function ActivitiesClient({ activities: initial, accounts, deals, currentUserId }: Props) {
  const t = useTranslations("activities")
  const [activities, setActivities] = useState(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: "call" as ActivityType,
    subject: "",
    notes: "",
    date: new Date().toISOString().slice(0, 16),
    follow_up_date: "",
    completed: false,
    account_id: "",
    deal_id: "",
    user_id: currentUserId,
  })

  async function handleSave() {
    setSaving(true)
    const { supabase, db } = getCompanyClientBrowser()
    const { data, error } = await db
      .from("activities")
      .insert([{
        ...form,
        account_id: form.account_id || null,
        deal_id: form.deal_id || null,
        follow_up_date: form.follow_up_date || null,
      }])
      .select("*, account:accounts(id, name), deal:deals(id, title), contact:contacts(id, first_name, last_name)")
      .single()
    if (!error && data) {
      setActivities(prev => [data, ...prev])
      setModalOpen(false)
      setForm({ type: "call", subject: "", notes: "", date: new Date().toISOString().slice(0, 16), follow_up_date: "", completed: false, account_id: "", deal_id: "", user_id: currentUserId })
    }
    setSaving(false)
  }

  async function toggleComplete(id: string, completed: boolean) {
    const { supabase, db } = getCompanyClientBrowser()
    await db.from("activities").update({ completed: !completed }).eq("id", id)
    setActivities(prev => prev.map(a => a.id === id ? { ...a, completed: !completed } : a))
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
            {upcoming.map(a => <ActivityRow key={a.id} activity={a} t={t} onToggle={toggleComplete} highlight />)}
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
          rest.map(a => <ActivityRow key={a.id} activity={a} t={t} onToggle={toggleComplete} />)
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("newActivity")}>
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
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Button>
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
  highlight = false,
}: {
  activity: ActivityFull
  t: ReturnType<typeof useTranslations<"activities">>
  onToggle: (id: string, completed: boolean) => void
  highlight?: boolean
}) {
  const Icon = typeIcon[a.type]
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
      <button
        onClick={() => onToggle(a.id, a.completed)}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${a.completed ? "bg-emerald-500 border-emerald-500" : "border-gray-300 hover:border-emerald-500"}`}
      >
        {a.completed && <Check className="w-3 h-3 text-white" />}
      </button>
    </div>
  )
}
