"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface Unit {
  id: string
  name: string
  type: string
}

interface Props {
  units: Unit[]
}

const TYPE_LABELS: Record<string, string> = {
  weight: "Poids",
  volume: "Volume",
  unit: "Unité",
}

const TYPE_OPTIONS = [
  { value: "unit", label: "Unité" },
  { value: "weight", label: "Poids" },
  { value: "volume", label: "Volume" },
]

export default function UnitesClient({ units: initial }: Props) {
  const [units, setUnits] = useState(initial)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState("unit")
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editType, setEditType] = useState("unit")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    setError("")
    const res = await fetch("/api/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), type: newType }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setUnits(u => [...u, json.unit].sort((a, b) => a.name.localeCompare(b.name)))
    setNewName("")
    setNewType("unit")
    setSaving(false)
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return
    setSaving(true)
    setError("")
    const res = await fetch(`/api/units/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), type: editType }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setUnits(u => u.map(x => x.id === id ? json.unit : x).sort((a, b) => a.name.localeCompare(b.name)))
    setEditId(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette unité ?")) return
    const res = await fetch(`/api/units/${id}`, { method: "DELETE" })
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setUnits(u => u.filter(x => x.id !== id))
  }

  function startEdit(unit: Unit) {
    setEditId(unit.id)
    setEditName(unit.name)
    setEditType(unit.type)
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Unités / Formats de conditionnement</h2>
      <p className="text-sm text-gray-500 mb-5">
        Gérez les unités utilisées pour les produits (ex : Fût 180 kg, Bidon 20 L, Pièce…).
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {/* Add row */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Nom (ex : Fût 180 kg)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={newType}
          onChange={e => setNewType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Button onClick={handleAdd} disabled={saving || !newName.trim()} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </div>

      {/* List */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {units.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Aucune unité définie</p>
        )}
        {units.map((unit, i) => (
          <div
            key={unit.id}
            className={`flex items-center gap-3 px-4 py-3 ${i < units.length - 1 ? "border-b border-gray-100" : ""}`}
          >
            {editId === unit.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(unit.id); if (e.key === "Escape") setEditId(null) }}
                  className="flex-1 border border-blue-400 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <select
                  value={editType}
                  onChange={e => setEditType(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                >
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button onClick={() => handleSaveEdit(unit.id)} disabled={saving} className="text-emerald-600 hover:text-emerald-700">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-gray-800">{unit.name}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {TYPE_LABELS[unit.type] ?? unit.type}
                </span>
                <button onClick={() => startEdit(unit)} className="text-gray-400 hover:text-blue-500 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(unit.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
