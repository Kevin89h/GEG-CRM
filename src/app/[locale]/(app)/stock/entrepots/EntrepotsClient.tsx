"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Plus, Warehouse as WarehouseIcon, MapPin, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import type { Warehouse } from "@/types"

interface Props { warehouses: Warehouse[] }

export default function EntrepotsClient({ warehouses: initial }: Props) {
  const t = useTranslations("entrepots")
  const [warehouses, setWarehouses] = useState(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({ name: "", city: "", address: "" })

  async function handleSave() {
    setSaving(true)
    setSaveError("")
    const res = await fetch("/api/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, city: form.city, address: form.address }),
    })
    const json = await res.json()
    if (!res.ok) {
      setSaveError(json.error ?? t("serverError"))
    } else {
      setWarehouses(prev => [...prev, json.data])
      setModalOpen(false)
      setForm({ name: "", city: "", address: "" })
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    await fetch("/api/warehouses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setWarehouses(prev => prev.filter(w => w.id !== id))
    setConfirmDeleteId(null)
    setDeleting(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("pageTitle")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{warehouses.length} {t("siteCount", { count: warehouses.length })}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          {t("newSite")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map(w => (
          <div key={w.id} className="relative bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <button
              onClick={() => setConfirmDeleteId(w.id)}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <WarehouseIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="font-semibold text-gray-900">{w.name}</h3>
                {(w.city || w.address) && (
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {[w.city, w.address].filter(Boolean).join(" — ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Placeholder ajouter */}
        <button
          onClick={() => setModalOpen(true)}
          className="border-2 border-dashed border-gray-200 rounded-xl p-5 flex items-center justify-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">{t("addSite")}</span>
        </button>
      </div>

      <Modal open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title={t("confirmDeleteTitle")}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t("confirmDeleteDescription")}</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>{t("cancel")}</Button>
            <button
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
            >
              {deleting ? t("deleting") : t("delete")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("newSiteModalTitle")}>
        <div className="space-y-4">
          <Input label={t("labelName")} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t("placeholderName")} required />
          <Input label={t("labelCity")} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder={t("placeholderCity")} />
          <Input label={t("labelAddress")} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={t("placeholderAddress")} />
          {saveError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.name || saving}>{saving ? t("saving") : t("save")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
