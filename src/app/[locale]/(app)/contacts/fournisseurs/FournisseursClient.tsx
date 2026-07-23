"use client"

import { useState } from "react"
import { Plus, Search, Building2, Phone, Mail, MapPin, Pencil, Trash2, Check, Users, Briefcase } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"

interface Supplier {
  id: string
  name: string
  phone: string | null
  email: string | null
  city: string | null
  country: string | null
  currency: string | null
  notes: string | null
  payment_terms: string | null
  iban: string | null
  swift: string | null
  bank_name: string | null
  is_active: boolean
}

const EMPTY_FORM = {
  name: "", phone: "", email: "", city: "", country: "",
  currency: "USD", notes: "", payment_terms: "", iban: "", swift: "", bank_name: "",
}

interface Props { fournisseurs: Supplier[] }

export default function FournisseursClient({ fournisseurs: initial }: Props) {
  const [fournisseurs, setFournisseurs] = useState(initial)
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const params = useParams()
  const locale = params.locale as string

  const filtered = fournisseurs.filter(f =>
    `${f.name} ${f.city ?? ""} ${f.country ?? ""} ${f.email ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSaveError(null)
    setModalOpen(true)
  }

  function openEdit(f: Supplier) {
    setEditingId(f.id)
    setForm({
      name: f.name,
      phone: f.phone ?? "",
      email: f.email ?? "",
      city: f.city ?? "",
      country: f.country ?? "",
      currency: f.currency ?? "USD",
      notes: f.notes ?? "",
      payment_terms: f.payment_terms ?? "",
      iban: f.iban ?? "",
      swift: f.swift ?? "",
      bank_name: f.bank_name ?? "",
    })
    setSaveError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError("Le nom du fournisseur est requis"); return }
    setSaving(true)
    setSaveError(null)
    const url = editingId ? `/api/suppliers/${editingId}` : "/api/suppliers"
    const method = editingId ? "PATCH" : "POST"
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) { setSaveError(json.error ?? "Erreur"); setSaving(false); return }
    if (editingId) {
      setFournisseurs(prev => prev.map(f => f.id === editingId ? { ...f, ...json } : f))
    } else {
      setFournisseurs(prev => [json, ...prev].sort((a, b) => a.name.localeCompare(b.name)))
    }
    setModalOpen(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Désactiver ce fournisseur ?")) return
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" })
    setFournisseurs(prev => prev.filter(f => f.id !== id))
  }

  const currencyColors: Record<string, string> = {
    USD: "bg-green-50 text-green-700",
    EUR: "bg-blue-50 text-blue-700",
    GNF: "bg-orange-50 text-orange-700",
  }

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <Link href={`/${locale}/contacts`}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 border-b-2 border-transparent hover:border-gray-300 transition-colors">
          <Users className="w-4 h-4" /> Contacts
        </Link>
        <Link href={`/${locale}/contacts/clients`}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 border-b-2 border-transparent hover:border-gray-300 transition-colors">
          <Briefcase className="w-4 h-4" /> Clients
        </Link>
        <Link href={`/${locale}/contacts/fournisseurs`}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
          <Building2 className="w-4 h-4" /> Fournisseurs
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Fournisseurs</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} fournisseur{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4" /> Nouveau fournisseur
        </Button>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un fournisseur…"
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucun fournisseur{search ? " correspondant" : " — ajoutez votre premier fournisseur"}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 font-medium bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3">Nom</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-left px-4 py-3">Localisation</th>
                <th className="text-left px-4 py-3">Devise</th>
                <th className="text-left px-4 py-3">Conditions</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(f => (
                <tr key={f.id} className="hover:bg-gray-50/60 group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-700 text-xs font-bold">{f.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="font-semibold text-gray-900">{f.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {f.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{f.email}</p>}
                    {f.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{f.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {(f.city || f.country) && (
                      <p className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {[f.city, f.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {f.currency && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${currencyColors[f.currency] ?? "bg-gray-100 text-gray-600"}`}>
                        {f.currency}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{f.payment_terms}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => openEdit(f)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(f.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Modifier le fournisseur" : "Nouveau fournisseur"}>
        <div className="space-y-4">
          <Input label="Nom du fournisseur *" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="TotalEnergies, YESIL…" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Téléphone" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+33 1 00 00 00 00" />
            <Input label="Email" type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@fournisseur.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ville" value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Paris, Dubai…" />
            <Input label="Pays" value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="France, UAE…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Devise</label>
            <div className="flex gap-2">
              {["USD", "EUR", "GNF"].map(cur => (
                <button key={cur} onClick={() => setForm(f => ({ ...f, currency: cur }))}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg border-2 transition ${
                    form.currency === cur
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-200 text-gray-600 hover:border-blue-300"
                  }`}>
                  {cur}
                </button>
              ))}
            </div>
          </div>
          <Input label="Conditions de paiement" value={form.payment_terms}
            onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="30 jours, 60 jours…" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="IBAN" value={form.iban}
              onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} />
            <Input label="SWIFT/BIC" value={form.swift}
              onChange={e => setForm(f => ({ ...f, swift: e.target.value }))} />
          </div>
          <Input label="Banque" value={form.bank_name}
            onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="BNP Paribas, Société Générale…" />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes internes</label>
            <textarea rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Délais, conditions, contacts habituels…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement…" : editingId ? <><Check className="w-4 h-4" /> Mettre à jour</> : <><Plus className="w-4 h-4" /> Créer</>}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
