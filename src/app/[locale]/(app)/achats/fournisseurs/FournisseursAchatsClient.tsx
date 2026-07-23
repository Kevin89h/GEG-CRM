"use client"

import { useState } from "react"
import { Plus, Search, Building2, Phone, Mail, MapPin, Pencil, X, CreditCard } from "lucide-react"

interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
  country: string | null
  city: string | null
  payment_terms: string | null
  currency: string | null
  iban: string | null
  swift: string | null
  bank_name: string | null
  notes: string | null
  is_active: boolean
  order_count: number
  order_total: number
}

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  currency: "USD",
  payment_terms: "",
  iban: "",
  swift: "",
  bank_name: "",
  notes: "",
}

const PAYMENT_TERMS_OPTIONS = [
  { value: "", label: "— Non défini —" },
  { value: "immediate", label: "Immédiat" },
  { value: "30j", label: "30 jours" },
  { value: "60j", label: "60 jours" },
  { value: "90j", label: "90 jours" },
]

interface Props {
  suppliers: Supplier[]
  locale: string
}

export default function FournisseursAchatsClient({ suppliers: initial, locale }: Props) {
  const [suppliers, setSuppliers] = useState(initial)
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const filtered = suppliers.filter(s =>
    `${s.name} ${s.city ?? ""} ${s.country ?? ""} ${s.email ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSaveError(null)
    setModalOpen(true)
  }

  function openEdit(s: Supplier) {
    setEditingId(s.id)
    setForm({
      name: s.name,
      email: s.email ?? "",
      phone: s.phone ?? "",
      country: s.country ?? "",
      city: s.city ?? "",
      currency: s.currency ?? "USD",
      payment_terms: s.payment_terms ?? "",
      iban: s.iban ?? "",
      swift: s.swift ?? "",
      bank_name: s.bank_name ?? "",
      notes: s.notes ?? "",
    })
    setSaveError(null)
    setModalOpen(true)
  }

  function setF<K extends keyof typeof EMPTY_FORM>(k: K, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError("Le nom est requis"); return }
    setSaving(true)
    setSaveError(null)
    try {
      const url = editingId ? `/api/suppliers/${editingId}` : "/api/suppliers"
      const method = editingId ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email || null,
          phone: form.phone || null,
          country: form.country || null,
          city: form.city || null,
          currency: form.currency,
          payment_terms: form.payment_terms || null,
          iban: form.iban || null,
          swift: form.swift || null,
          bank_name: form.bank_name || null,
          notes: form.notes || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setSaveError(json.error ?? "Erreur lors de la sauvegarde"); return }
      if (editingId) {
        setSuppliers(list => list.map(s => s.id === editingId ? { ...s, ...json } : s))
      } else {
        setSuppliers(list => [...list, { ...json, order_count: 0, order_total: 0 }])
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Désactiver ce fournisseur ?")) return
    const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" })
    if (res.ok) setSuppliers(list => list.filter(s => s.id !== id))
  }

  const ptLabel = (pt: string | null) => PAYMENT_TERMS_OPTIONS.find(o => o.value === pt)?.label ?? pt ?? "—"

  return (
    <div className="-mx-4 -my-4 md:-m-6 min-h-screen bg-gray-50/50">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-3">
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition"
        >
          <Plus className="w-3.5 h-3.5" /> Nouveau fournisseur
        </button>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-52"
          />
        </div>
        <span className="text-xs text-gray-400">{filtered.length} fournisseur{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="px-4 md:px-6 py-4">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-20 text-center text-gray-400">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun fournisseur trouvé</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium">
                  <th className="text-left px-4 py-3">Nom</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Pays</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Devise</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Conditions paiement</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Contact</th>
                  <th className="text-right px-4 py-3 hidden lg:table-cell">Commandes</th>
                  <th className="text-right px-4 py-3 hidden xl:table-cell">Total commandé</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{s.name}</div>
                      {s.city && <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{s.city}</div>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">{s.country ?? "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700">{s.currency ?? "USD"}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-600">{ptLabel(s.payment_terms)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="space-y-0.5">
                        {s.phone && <div className="flex items-center gap-1 text-xs text-gray-500"><Phone className="w-3 h-3" />{s.phone}</div>}
                        {s.email && <div className="flex items-center gap-1 text-xs text-gray-500"><Mail className="w-3 h-3" />{s.email}</div>}
                        {!s.phone && !s.email && <span className="text-xs text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-right">
                      <span className="text-sm font-semibold text-gray-900">{s.order_count}</span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-right text-xs text-gray-600 tabular-nums">
                      {s.order_total > 0 ? s.order_total.toLocaleString("fr") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editingId ? "Modifier le fournisseur" : "Nouveau fournisseur"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom *</label>
                <input value={form.name} onChange={e => setF("name", e.target.value)} placeholder="TotalEnergies, YESIL…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => setF("email", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Téléphone</label>
                  <input value={form.phone} onChange={e => setF("phone", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Pays</label>
                  <input value={form.country} onChange={e => setF("country", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Ville</label>
                  <input value={form.city} onChange={e => setF("city", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Devise</label>
                  <select value={form.currency} onChange={e => setF("currency", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="USD">USD</option>
                    <option value="GNF">GNF</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Conditions de paiement</label>
                  <select value={form.payment_terms} onChange={e => setF("payment_terms", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {PAYMENT_TERMS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                  <CreditCard className="w-3.5 h-3.5" /> Coordonnées bancaires
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Banque</label>
                    <input value={form.bank_name} onChange={e => setF("bank_name", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">IBAN</label>
                    <input value={form.iban} onChange={e => setF("iban", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">SWIFT / BIC</label>
                    <input value={form.swift} onChange={e => setF("swift", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes internes</label>
                <textarea rows={2} value={form.notes} onChange={e => setF("notes", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm bg-[#7c3aed] text-white font-medium rounded-lg hover:bg-[#6d28d9] disabled:opacity-50 transition">
                {saving ? "Enregistrement…" : editingId ? "Mettre à jour" : "Créer le fournisseur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
