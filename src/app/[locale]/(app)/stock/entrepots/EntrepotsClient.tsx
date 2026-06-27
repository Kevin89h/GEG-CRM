"use client"

import { useState } from "react"
import { Plus, Warehouse as WarehouseIcon, MapPin, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import type { Warehouse } from "@/types"

interface Props { warehouses: Warehouse[] }

export default function EntrepotsClient({ warehouses: initial }: Props) {
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
      setSaveError(json.error ?? "Erreur serveur")
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
          <h1 className="text-2xl font-bold text-gray-900">Sites de stockage</h1>
          <p className="text-gray-500 text-sm mt-0.5">{warehouses.length} site{warehouses.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouveau site
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map(w => (
          <div key={w.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <WarehouseIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{w.name}</h3>
                {(w.city || w.address) && (
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {[w.city, w.address].filter(Boolean).join(" — ")}
                  </p>
                )}
              </div>
              <button
                onClick={() => setConfirmDeleteId(w.id)}
                className="ml-2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Placeholder ajouter */}
        <button
          onClick={() => setModalOpen(true)}
          className="border-2 border-dashed border-gray-200 rounded-xl p-5 flex items-center justify-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">Ajouter un site</span>
        </button>
      </div>

      <Modal open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="Supprimer le site ?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Ce site sera désactivé et n'apparaîtra plus dans les mouvements de stock. Les données existantes sont conservées.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>Annuler</Button>
            <button
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau site de stockage">
        <div className="space-y-4">
          <Input label="Nom du site" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Dépôt Conakry principal" required />
          <Input label="Ville" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Conakry" />
          <Input label="Adresse" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Zone industrielle de Kaloum..." />
          {saveError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.name || saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
