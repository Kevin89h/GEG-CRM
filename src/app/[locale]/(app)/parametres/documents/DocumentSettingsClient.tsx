"use client"

import { useState, useRef } from "react"
import { Upload, Save, Eye, Building2, Phone, Mail, Globe, FileText, Palette, Landmark } from "lucide-react"
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
  tva_rate?: number | null
  brand_color?: string | null
}

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
    title: "Informations bancaires",
    icon: Landmark,
    fields: [
      { key: "bank_name", label: "Nom de la banque", placeholder: "ECOBANK" },
      { key: "bank_account", label: "N° de compte", placeholder: "7308052262" },
      { key: "bank_iban", label: "IBAN / RIB", placeholder: "GN..." },
    ],
  },
  {
    title: "Documents",
    icon: FileText,
    fields: [
      { key: "tva_rate_str", label: "Taux TVA (%)", placeholder: "18" },
      { key: "footer_text", label: "Pied de page", placeholder: "Merci pour votre confiance. Règlement à 30 jours.", textarea: true },
    ],
  },
]

export default function DocumentSettingsClient({ settings: initial, companyId }: Props) {
  const [form, setForm] = useState<Settings & { tva_rate_str?: string }>(
    initial
      ? { ...initial, tva_rate_str: String(initial.tva_rate ?? 18) }
      : { company_id: companyId, country: "Guinée", brand_color: "#0d2545", tva_rate_str: "18", logo_url: "/geg-logo.png" }
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
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
    const tvaStr = (form as Record<string, unknown>).tva_rate_str as string | undefined
    const payload: Record<string, unknown> = {
      ...form,
      tva_rate: tvaStr ? parseFloat(tvaStr) : (form.tva_rate ?? 18),
      company_id: companyId,
      updated_at: new Date().toISOString(),
    }
    delete payload.tva_rate_str

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
            onClick={() => setPreview(p => !p)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >
            <Eye className="w-4 h-4" /> {preview ? "Masquer" : "Aperçu"}
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

      <div className={`grid gap-6 ${preview ? "grid-cols-2" : "grid-cols-1"}`}>
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
        </div>

        {/* Preview */}
        {preview && (
          <div className="sticky top-6 h-fit">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Aperçu en-tête document</p>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Document header preview */}
              <div style={{ borderTopWidth: 4, borderTopStyle: "solid", borderTopColor: brandColor }} className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    {form.logo_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={form.logo_url} alt="Logo" className="h-14 object-contain mb-2" />
                      : <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: brandColor }}>
                          <span className="text-white font-bold text-xl">{(form.company_name ?? "G").charAt(0)}</span>
                        </div>
                    }
                    <p className="font-bold text-gray-900 text-sm">{form.company_name || "Nom de la société"}</p>
                    {form.tagline && <p className="text-xs text-gray-400">{form.tagline}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: brandColor }}>FACTURE</p>
                    <p className="text-xs text-gray-400 font-mono mt-1">FAC/2026/00001</p>
                    <p className="text-xs text-gray-400">Date : 23 mai 2026</p>
                    <p className="text-xs text-gray-400">Échéance : 22 juin 2026</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs mb-6">
                  <div>
                    <p className="font-semibold text-gray-500 uppercase text-xs mb-1">Émetteur</p>
                    {form.address_line1 && <p className="text-gray-700">{form.address_line1}</p>}
                    {form.address_line2 && <p className="text-gray-700">{form.address_line2}</p>}
                    {(form.city || form.country) && <p className="text-gray-700">{[form.city, form.country].filter(Boolean).join(", ")}</p>}
                    {form.phone && <p className="text-gray-500">{form.phone}</p>}
                    {form.email && <p className="text-gray-500">{form.email}</p>}
                    {form.rccm && <p className="text-gray-400">RCCM : {form.rccm}</p>}
                    {form.nif && <p className="text-gray-400">NIF : {form.nif}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-500 uppercase text-xs mb-1">Facturé à</p>
                    <p className="font-semibold text-gray-800">CLIENT EXEMPLE</p>
                    <p className="text-gray-500">Conakry, Guinée</p>
                  </div>
                </div>

                {/* Fake table */}
                <div className="mb-4">
                  <div className="text-xs py-2 px-3 text-white rounded-t" style={{ backgroundColor: brandColor }}>
                    <div className="grid grid-cols-4 font-medium">
                      <span className="col-span-2">Description</span>
                      <span className="text-right">Qté × Prix</span>
                      <span className="text-right">Total</span>
                    </div>
                  </div>
                  <div className="text-xs py-2 px-3 bg-gray-50 grid grid-cols-4 border-b border-gray-100">
                    <span className="col-span-2 text-gray-700">Produit exemple</span>
                    <span className="text-right text-gray-500">10 × 50 000</span>
                    <span className="text-right font-medium text-gray-900">500 000 GNF</span>
                  </div>
                  <div className="text-xs pt-2 px-3 flex justify-end">
                    <div className="text-right space-y-0.5">
                      <div className="flex gap-8">
                        <span className="text-gray-500">Total HT</span>
                        <span className="font-bold text-gray-900">500 000 GNF</span>
                      </div>
                      <div className="flex gap-8">
                        <span className="font-semibold" style={{ color: brandColor }}>Montant dû</span>
                        <span className="font-bold" style={{ color: brandColor }}>500 000 GNF</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                {(form.bank_details || form.footer_text) && (
                  <div className="border-t border-gray-100 pt-3 mt-3 space-y-1">
                    {form.bank_details && <p className="text-xs text-gray-500">{form.bank_details}</p>}
                    {form.footer_text && <p className="text-xs text-gray-400 italic">{form.footer_text}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
