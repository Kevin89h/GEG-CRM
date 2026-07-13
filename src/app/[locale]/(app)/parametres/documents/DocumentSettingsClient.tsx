"use client"

import { useState, useRef, useEffect } from "react"
import { Upload, Save, Eye, Building2, Phone, FileText, Palette, Landmark, Plus, Pencil, Trash2, X, Check } from "lucide-react"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser" // storage upload only

interface Settings {
  id?: string
  company_id?: string
  company_name?: string | null
  tagline?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  rccm?: string | null
  nif?: string | null
  logo_url?: string | null
  footer_text?: string | null
  bank_details?: string | null
  bank_name?: string | null
  bank_account?: string | null
  bank_iban?: string | null
  brand_color?: string | null
  layout_config?: LayoutConfig | null
}

interface LayoutConfig {
  show_stripe?: boolean
  show_logo?: boolean
  logo_position?: "left" | "right"
  show_tagline?: boolean
  show_company_address?: boolean
  show_client_phone?: boolean
  show_client_location?: boolean
  client_position?: "left" | "right"
  show_meta_issue_date?: boolean
  show_meta_due_date?: boolean
  show_meta_currency?: boolean
  show_notes?: boolean
  show_payment_comm?: boolean
  show_bank_section?: boolean
  show_footer_phone?: boolean
  show_footer_website?: boolean
  show_footer_nif?: boolean
  show_footer_email?: boolean
}

interface BankAccount {
  id: string
  institution: string
  account_number: string
  swift: string | null
  iban: string | null
  currency: string
  is_active: boolean
}

const EMPTY_BANK: Omit<BankAccount, "id"> = {
  institution: "", account_number: "", swift: "", iban: "", currency: "GNF", is_active: true,
}
const CURRENCIES = ["GNF", "USD", "EUR"]

interface Props {
  settings: Settings | null
  companyId: string
}

const FIELD_GROUPS = [
  {
    title: "Identité de la société",
    icon: Building2,
    fields: [
      { key: "company_name", label: "Nom de la société", placeholder: "GEG Guinée SARL" },
      { key: "tagline", label: "Slogan / activité", placeholder: "Importation et distribution d'énergie" },
    ],
  },
  {
    title: "Coordonnées",
    icon: Phone,
    fields: [
      { key: "address_line1", label: "Adresse ligne 1", placeholder: "BP 1234, Quartier Kaloum" },
      { key: "address_line2", label: "Adresse ligne 2", placeholder: "" },
      { key: "city", label: "Ville", placeholder: "Conakry" },
      { key: "country", label: "Pays", placeholder: "Guinée" },
      { key: "phone", label: "Téléphone", placeholder: "+224 600 000 000" },
      { key: "email", label: "Email", placeholder: "contact@geg.gn" },
      { key: "website", label: "Site web", placeholder: "www.geg.gn" },
    ],
  },
  {
    title: "Informations fiscales",
    icon: Landmark,
    fields: [
      { key: "rccm", label: "N° RCCM", placeholder: "RCCM/GN/..." },
      { key: "nif", label: "NIF", placeholder: "123456789" },
    ],
  },
  {
    title: "Documents",
    icon: FileText,
    fields: [
      { key: "footer_text", label: "Pied de page", placeholder: "Merci pour votre confiance. Règlement à 30 jours.", textarea: true },
    ],
  },
]

export default function DocumentSettingsClient({ settings: initial, companyId }: Props) {
  const [form, setForm] = useState<Settings & { tva_rate_str?: string }>(
    initial
      ? { ...initial }
      : { company_id: companyId, country: "Guinée", brand_color: "#0d2545", logo_url: "/geg-logo.png" }
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [editingBank, setEditingBank] = useState<string | null>(null) // id or "new"
  const [bankForm, setBankForm] = useState<Omit<BankAccount, "id">>(EMPTY_BANK)
  const [bankSaving, setBankSaving] = useState(false)

  useEffect(() => {
    fetch("/api/treasury/accounts")
      .then(r => r.json())
      .then(d => setBankAccounts(d.accounts ?? []))
  }, [])

  async function saveBank() {
    if (!bankForm.institution || !bankForm.account_number) return
    setBankSaving(true)
    const isNew = editingBank === "new"
    const url = isNew ? "/api/treasury/accounts" : `/api/treasury/accounts/${editingBank}`
    const method = isNew ? "POST" : "PATCH"
    const body = isNew
      ? { ...bankForm, name: `${bankForm.institution} – ${bankForm.currency}`, type: "bank" }
      : { ...bankForm, name: `${bankForm.institution} – ${bankForm.currency}`, type: "bank" }
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (res.ok) {
      const data = await res.json()
      if (isNew && data.account) {
        setBankAccounts(prev => [...prev, data.account])
      } else {
        setBankAccounts(prev => prev.map(a => a.id === editingBank ? { ...a, ...bankForm } : a))
      }
      setEditingBank(null)
      setBankForm(EMPTY_BANK)
    }
    setBankSaving(false)
  }

  async function deleteBank(id: string) {
    if (!confirm("Supprimer ce compte bancaire ?")) return
    await fetch(`/api/treasury/accounts/${id}?action=purge`, { method: "DELETE" })
    setBankAccounts(prev => prev.filter(a => a.id !== id))
  }

  function startEdit(acc: BankAccount) {
    setEditingBank(acc.id)
    setBankForm({ institution: acc.institution, account_number: acc.account_number, swift: acc.swift ?? "", iban: acc.iban ?? "", currency: acc.currency, is_active: acc.is_active })
  }

  function setBank(key: string, value: string) {
    setBankForm(f => ({ ...f, [key]: value }))
  }

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function loadPreview() {
    setPreviewLoading(true)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const res = await fetch("/api/parametres/document-settings/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const blob = await res.blob()
      setPreviewUrl(URL.createObjectURL(blob))
    }
    setPreviewLoading(false)
  }

  async function uploadLogo(file: File) {
    setUploading(true)
    const { supabase } = getCompanyClientBrowser()
    const ext = file.name.split(".").pop()
    const path = `${companyId}/logo.${ext}`
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path)
      setForm(f => ({ ...f, logo_url: `${publicUrl}?t=${Date.now()}` }))
    }
    setUploading(false)
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    const payload: Record<string, unknown> = {
      ...form,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    }

    const res = await fetch("/api/parametres/document-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await res.json()

    if (!res.ok) {
      setSaveError(json.error ?? "Erreur lors de l'enregistrement")
      setSaving(false)
      return
    }

    if (!form.id && json?.id) setForm(f => ({ ...f, id: json.id }))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const brandColor = form.brand_color ?? "#2563eb"

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">Configurez l'en-tête et le pied de page de vos documents imprimés</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (preview) { setPreview(false) } else { setPreview(true); loadPreview() }
            }}
            disabled={previewLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <Eye className="w-4 h-4" /> {preview ? "Masquer" : previewLoading ? "Génération…" : "Aperçu PDF"}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Enregistrement…" : saved ? "Enregistré ✓" : "Enregistrer"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className={`grid gap-6 ${preview ? "grid-cols-[1fr_1.2fr]" : "grid-cols-1"}`}>
        {/* Form */}
        <div className="space-y-6">
          {/* Logo + couleur */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Palette className="w-4 h-4 text-gray-400" /> Logo & couleur
            </h2>
            <div className="flex items-start gap-6">
              {/* Logo zone */}
              <div
                onClick={() => fileRef.current?.click()}
                className="w-40 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition overflow-hidden"
              >
                {form.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logo_url} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-gray-300 mb-1" />
                    <p className="text-xs text-gray-400">{uploading ? "Upload…" : "Cliquer pour logo"}</p>
                    <p className="text-xs text-gray-300">PNG, JPG, SVG · max 2 Mo</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />

              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Couleur principale</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={brandColor}
                      onChange={e => set("brand_color", e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                    <input type="text" value={brandColor}
                      onChange={e => set("brand_color", e.target.value)}
                      className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <div className="flex gap-2">
                      {["#2563eb","#16a34a","#dc2626","#7c3aed","#d97706","#0f172a"].map(c => (
                        <button key={c} onClick={() => set("brand_color", c)}
                          className="w-7 h-7 rounded-full border-2 transition"
                          style={{ backgroundColor: c, borderColor: brandColor === c ? c : "transparent" }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Field groups */}
          {FIELD_GROUPS.map(group => {
            const Icon = group.icon
            return (
              <div key={group.title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gray-400" /> {group.title}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {group.fields.map(f => (
                    <div key={f.key} className={(f as { textarea?: boolean }).textarea ? "col-span-2" : ""}>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{f.label}</label>
                      {(f as { textarea?: boolean }).textarea ? (
                        <textarea
                          rows={3}
                          value={(form as Record<string, string | null | undefined>)[f.key] ?? ""}
                          onChange={e => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={(form as Record<string, string | null | undefined>)[f.key] ?? ""}
                          onChange={e => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {/* Layout config */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" /> Mise en page de la facture
            </h2>
            <div className="space-y-5">
              {/* Position options */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Position</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1.5">Logo</p>
                    <div className="flex gap-2">
                      {(["left", "right"] as const).map(pos => (
                        <button key={pos}
                          onClick={() => setForm(f => ({ ...f, layout_config: { ...(f.layout_config ?? {}), logo_position: pos } }))}
                          className={`flex-1 py-1.5 text-xs rounded-lg border transition ${(form.layout_config?.logo_position ?? "left") === pos ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                        >
                          {pos === "left" ? "← Gauche" : "Droite →"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1.5">Bloc client / N° facture</p>
                    <div className="flex gap-2">
                      {(["left", "right"] as const).map(pos => (
                        <button key={pos}
                          onClick={() => setForm(f => ({ ...f, layout_config: { ...(f.layout_config ?? {}), client_position: pos } }))}
                          className={`flex-1 py-1.5 text-xs rounded-lg border transition ${(form.layout_config?.client_position ?? "left") === pos ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                        >
                          {pos === "left" ? "← Gauche" : "Droite →"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Toggle groups */}
              {([
                {
                  label: "En-tête",
                  items: [
                    { key: "show_stripe",          label: "Bande colorée" },
                    { key: "show_logo",             label: "Logo" },
                    { key: "show_tagline",          label: "Slogan" },
                    { key: "show_company_address",  label: "Adresse société" },
                  ],
                },
                {
                  label: "Bloc client",
                  items: [
                    { key: "show_client_location", label: "Ville / Pays client" },
                    { key: "show_client_phone",    label: "Téléphone client" },
                  ],
                },
                {
                  label: "Barre de méta",
                  items: [
                    { key: "show_meta_issue_date", label: "Date de la facture" },
                    { key: "show_meta_due_date",   label: "Date d'échéance" },
                    { key: "show_meta_currency",   label: "Devise" },
                  ],
                },
                {
                  label: "Corps",
                  items: [
                    { key: "show_notes",        label: "Notes / remarques" },
                    { key: "show_payment_comm", label: "Communication de paiement" },
                    { key: "show_bank_section", label: "Coordonnées bancaires" },
                  ],
                },
                {
                  label: "Pied de page",
                  items: [
                    { key: "show_footer_phone",   label: "Téléphone" },
                    { key: "show_footer_website", label: "Site web" },
                    { key: "show_footer_email",   label: "Email" },
                    { key: "show_footer_nif",     label: "NIF" },
                  ],
                },
              ] as { label: string; items: { key: string; label: string }[] }[]).map(group => (
                <div key={group.label}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map(item => {
                      const val = (form.layout_config as Record<string, unknown> | null | undefined)?.[item.key] !== false
                      return (
                        <button key={item.key}
                          onClick={() => setForm(f => ({ ...f, layout_config: { ...(f.layout_config ?? {}), [item.key]: !val } }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${val ? "border-blue-200 bg-blue-50 text-blue-800" : "border-gray-200 bg-gray-50 text-gray-400 line-through"}`}
                        >
                          <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs ${val ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300"}`}>
                            {val ? "✓" : ""}
                          </span>
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bank accounts manager */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-gray-400" /> Comptes bancaires (factures PDF)
              </h2>
              {editingBank !== "new" && (
                <button
                  onClick={() => { setEditingBank("new"); setBankForm(EMPTY_BANK) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter un compte
                </button>
              )}
            </div>

            {/* Table */}
            {bankAccounts.length > 0 && (
              <div className="mb-4 rounded-lg border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-2">Banque</th>
                      <th className="text-left px-3 py-2">N° compte</th>
                      <th className="text-left px-3 py-2">SWIFT</th>
                      <th className="text-left px-3 py-2">IBAN</th>
                      <th className="text-left px-3 py-2 w-16">Devise</th>
                      <th className="px-3 py-2 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bankAccounts.map(acc => (
                      editingBank === acc.id ? (
                        <tr key={acc.id} className="bg-blue-50">
                          <td className="px-2 py-1.5"><input autoFocus className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" value={bankForm.institution} onChange={e => setBank("institution", e.target.value)} placeholder="ECOBANK" /></td>
                          <td className="px-2 py-1.5"><input className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" value={bankForm.account_number} onChange={e => setBank("account_number", e.target.value)} placeholder="7308052262" /></td>
                          <td className="px-2 py-1.5"><input className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" value={bankForm.swift ?? ""} onChange={e => setBank("swift", e.target.value)} placeholder="ECOCGNCN" /></td>
                          <td className="px-2 py-1.5"><input className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" value={bankForm.iban ?? ""} onChange={e => setBank("iban", e.target.value)} placeholder="GN01000..." /></td>
                          <td className="px-2 py-1.5">
                            <select className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" value={bankForm.currency} onChange={e => setBank("currency", e.target.value)}>
                              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex gap-1 justify-end">
                              <button onClick={saveBank} disabled={bankSaving} className="p-1 rounded text-green-600 hover:bg-green-100"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingBank(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={acc.id} className="hover:bg-gray-50 group">
                          <td className="px-3 py-2 font-medium text-gray-800">{acc.institution}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono text-xs">{acc.account_number}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{acc.swift ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{acc.iban ?? "—"}</td>
                          <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">{acc.currency}</span></td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition">
                              <button onClick={() => startEdit(acc)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteBank(acc.id)} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* New account form */}
            {editingBank === "new" && (
              <div className="grid grid-cols-5 gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Banque *</label>
                  <input autoFocus className="w-full px-2 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={bankForm.institution} onChange={e => setBank("institution", e.target.value)} placeholder="ECOBANK" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">N° compte *</label>
                  <input className="w-full px-2 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={bankForm.account_number} onChange={e => setBank("account_number", e.target.value)} placeholder="7308052262" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">SWIFT / BIC</label>
                  <input className="w-full px-2 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={bankForm.swift ?? ""} onChange={e => setBank("swift", e.target.value)} placeholder="ECOCGNCN" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">IBAN</label>
                  <input className="w-full px-2 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={bankForm.iban ?? ""} onChange={e => setBank("iban", e.target.value)} placeholder="GN01000..." />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Devise</label>
                  <select className="w-full px-2 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={bankForm.currency} onChange={e => setBank("currency", e.target.value)}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-5 flex justify-end gap-2 mt-1">
                  <button onClick={() => setEditingBank(null)} className="px-3 py-1.5 text-sm rounded-lg text-gray-600 hover:bg-gray-100 transition">Annuler</button>
                  <button onClick={saveBank} disabled={bankSaving || !bankForm.institution || !bankForm.account_number} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition">
                    {bankSaving ? "Enregistrement…" : "Ajouter"}
                  </button>
                </div>
              </div>
            )}

            {bankAccounts.length === 0 && editingBank !== "new" && (
              <p className="text-sm text-gray-400 text-center py-4">Aucun compte bancaire. Ces comptes apparaissent dans vos factures PDF.</p>
            )}
          </div>
        </div>

        {/* Preview — real PDF in iframe */}
        {preview && (
          <div className="sticky top-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Aperçu PDF réel</p>
              <button
                onClick={loadPreview}
                disabled={previewLoading}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                {previewLoading ? "Génération…" : "↺ Rafraîchir"}
              </button>
            </div>
            <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-gray-100" style={{ height: "calc(100vh - 140px)" }}>
              {previewLoading && (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  Génération du PDF…
                </div>
              )}
              {!previewLoading && previewUrl && (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Aperçu facture"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
