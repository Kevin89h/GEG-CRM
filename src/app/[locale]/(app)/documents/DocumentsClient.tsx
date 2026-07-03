"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  FolderOpen, Upload, Search, File, FileText, Trash2,
  ExternalLink, Plus, X, Tag, Lock, Building2, ShieldCheck,
  Download,
} from "lucide-react"
import { formatDate } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category { id: string; name: string; color: string }
interface Account  { id: string; name: string }

type Visibility = "all" | "admin" | "finance" | "management"

interface Document {
  id: string
  name: string
  description: string | null
  file_url: string
  file_name: string
  file_size: number | null
  file_type: string | null
  created_at: string
  visibility: Visibility
  is_company_doc: boolean
  doc_type: string | null
  category: Category | null
  account: Account | null
}

interface Props {
  documents: Document[]
  categories: Category[]
  accounts: Account[]
  userRole: string
  isAdmin: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANY_DOC_TYPES = [
  { value: "registre_commerce",  label: "Registre de commerce",     color: "#2563eb" },
  { value: "nif",                label: "NIF",                      color: "#16a34a" },
  { value: "titre_foncier",      label: "Titre foncier",            color: "#9333ea" },
  { value: "quitus_fiscal",      label: "Quitus fiscal",            color: "#ea580c" },
  { value: "statuts",            label: "Statuts de la société",    color: "#0891b2" },
  { value: "autorisation",       label: "Autorisation d'exercer",   color: "#be185d" },
  { value: "contrat_bail",       label: "Contrat de bail",          color: "#78716c" },
  { value: "assurance",          label: "Assurance",                color: "#b45309" },
  { value: "autre",              label: "Autre document officiel",  color: "#374151" },
]

const VISIBILITY_OPTIONS: { value: Visibility; label: string; desc: string }[] = [
  { value: "all",        label: "Tous les utilisateurs",  desc: "Visible par tout le monde" },
  { value: "admin",      label: "Administrateurs seuls",  desc: "Admin uniquement" },
  { value: "finance",    label: "Finance",                desc: "Admin + Finance" },
  { value: "management", label: "Management",             desc: "Admin + Management" },
]

const VISIBILITY_COLORS: Record<Visibility, string> = {
  all:        "bg-green-50 text-green-700 border-green-200",
  admin:      "bg-red-50 text-red-700 border-red-200",
  finance:    "bg-purple-50 text-purple-700 border-purple-200",
  management: "bg-blue-50 text-blue-700 border-blue-200",
}
const VISIBILITY_LABELS: Record<Visibility, string> = {
  all: "Tous", admin: "Admin", finance: "Finance", management: "Management",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileIcon(type: string | null) {
  if (!type) return <File className="w-5 h-5 text-gray-400" />
  if (type.includes("pdf"))   return <FileText className="w-5 h-5 text-red-500" />
  if (type.includes("image")) return <File className="w-5 h-5 text-blue-500" />
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv"))
    return <File className="w-5 h-5 text-green-500" />
  if (type.includes("word"))  return <FileText className="w-5 h-5 text-blue-600" />
  return <File className="w-5 h-5 text-gray-400" />
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentsClient({ documents: initial, categories, accounts, userRole, isAdmin }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [docs, setDocs] = useState(initial)
  const [tab, setTab] = useState<"documents" | "societe">("documents")
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState("all")
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")

  // Form
  const [file, setFile] = useState<File | null>(null)
  const [docName, setDocName] = useState("")
  const [docDesc, setDocDesc] = useState("")
  const [docCat, setDocCat] = useState("")
  const [docAccount, setDocAccount] = useState("")
  const [docVisibility, setDocVisibility] = useState<Visibility>("all")
  const [isCompanyDoc, setIsCompanyDoc] = useState(false)
  const [docType, setDocType] = useState("")

  // Derived lists
  const regularDocs = docs.filter(d => !d.is_company_doc)
  const companyDocs = docs.filter(d => d.is_company_doc)

  const filteredRegular = regularDocs.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === "all" || d.category?.id === filterCat
    return matchSearch && matchCat
  })

  function resetForm() {
    setFile(null)
    setDocName("")
    setDocDesc("")
    setDocCat("")
    setDocAccount("")
    setDocVisibility("all")
    setIsCompanyDoc(false)
    setDocType("")
    setUploadError("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (f && !docName) setDocName(f.name.replace(/\.[^/.]+$/, ""))
  }

  async function handleUpload() {
    if (!file || !docName.trim()) return
    setUploading(true)
    setUploadError("")
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Non authentifié")

      const path = `${user.id}/${Date.now()}_${file.name}`
      const { error: storageError } = await supabase.storage.from("documents").upload(path, file)
      if (storageError) throw storageError

      const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path)

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: docName.trim(),
          description: docDesc.trim() || null,
          category_id: docCat || null,
          account_id: docAccount || null,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id,
          visibility: docVisibility,
          is_company_doc: isCompanyDoc,
          doc_type: isCompanyDoc ? docType || null : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur")

      if (json) {
        const normalized = {
          ...json,
          category: Array.isArray(json.category) ? (json.category[0] ?? null) : json.category,
          account:  Array.isArray(json.account)  ? (json.account[0]  ?? null) : json.account,
        } as Document
        setDocs(prev => [normalized, ...prev])
      }
      setShowModal(false)
      resetForm()
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Erreur upload")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Supprimer "${doc.name}" ?`)) return
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" })
    if (!res.ok) {
      const json = await res.json()
      setUploadError(json.error ?? "Erreur lors de la suppression")
      return
    }
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  // Open upload modal pre-set for company doc
  function openCompanyDocModal() {
    setIsCompanyDoc(true)
    setDocVisibility("admin")
    setShowModal(true)
  }

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Upload modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900 text-lg">
                {isCompanyDoc ? "Document officiel société" : "Ajouter un document"}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm() }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Company doc toggle (admin only) */}
            {isAdmin && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
                <input type="checkbox" id="isCompanyDoc" checked={isCompanyDoc}
                  onChange={e => { setIsCompanyDoc(e.target.checked); if (e.target.checked) setDocVisibility("admin") }}
                  className="w-4 h-4 accent-blue-600" />
                <label htmlFor="isCompanyDoc" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Document officiel de la société
                </label>
              </div>
            )}

            {/* File drop zone */}
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center mb-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition"
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  {fileIcon(file.type)}
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Cliquer pour sélectionner un fichier</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, Images — max 50 MB</p>
                </>
              )}
              <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.txt" />
            </div>

            <div className="space-y-3">
              {/* Doc type (company docs) */}
              {isCompanyDoc && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type de document *</label>
                  <select value={docType} onChange={e => setDocType(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Sélectionner —</option>
                    {COMPANY_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom du document *</label>
                <input value={docName} onChange={e => setDocName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom du document" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea value={docDesc} onChange={e => setDocDesc(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Description optionnelle" />
              </div>

              {/* Visibility — admin only */}
              {isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> Accès
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {VISIBILITY_OPTIONS.map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setDocVisibility(opt.value)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium text-left border transition ${
                          docVisibility === opt.value
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}>
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-gray-400 text-[10px]">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isCompanyDoc && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Catégorie</label>
                    <select value={docCat} onChange={e => setDocCat(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— Aucune —</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Compte lié</label>
                    <select value={docAccount} onChange={e => setDocAccount(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— Aucun —</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {uploadError && <p className="text-xs text-red-600 mt-3">{uploadError}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowModal(false); resetForm() }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition" disabled={uploading}>
                Annuler
              </button>
              <button onClick={handleUpload} disabled={!file || !docName.trim() || uploading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-40">
                {uploading ? "Envoi…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">{docs.length} document{docs.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={openCompanyDocModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-700 transition shadow-sm">
              <Building2 className="w-4 h-4" />
              Document société
            </button>
          )}
          <button onClick={() => { setIsCompanyDoc(false); setDocVisibility("all"); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition shadow-sm">
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
        <button onClick={() => setTab("documents")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${tab === "documents" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          Documents
        </button>
        <button onClick={() => setTab("societe")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${tab === "societe" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          <ShieldCheck className="w-4 h-4" />
          Documents Société
          {companyDocs.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{companyDocs.length}</span>
          )}
        </button>
      </div>

      {/* ── TAB: Documents société ── */}
      {tab === "societe" && (
        <div className="space-y-3">
          {COMPANY_DOC_TYPES.map(type => {
            const typeDocs = companyDocs.filter(d => d.doc_type === type.value)
            return (
              <div key={type.value} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50"
                  style={{ borderLeft: `4px solid ${type.color}` }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: type.color }} />
                    <span className="text-sm font-semibold text-gray-800">{type.label}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${typeDocs.length > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                    {typeDocs.length > 0 ? `${typeDocs.length} fichier${typeDocs.length > 1 ? "s" : ""}` : "Aucun"}
                  </span>
                </div>
                {typeDocs.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {typeDocs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 flex-shrink-0">
                          {fileIcon(doc.file_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                          <p className="text-xs text-gray-400">{formatDate(doc.created_at, "fr")} · {formatSize(doc.file_size)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${VISIBILITY_COLORS[doc.visibility ?? "all"]}`}>
                            <Lock className="w-2.5 h-2.5 inline mr-1" />
                            {VISIBILITY_LABELS[doc.visibility ?? "all"]}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                            <a href={doc.file_url} target="_blank" rel="noreferrer" download
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <a href={doc.file_url} target="_blank" rel="noreferrer"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            {isAdmin && (
                              <button onClick={() => handleDelete(doc)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-xs text-gray-400 italic">
                    Aucun document · <button onClick={openCompanyDocModal} className="text-blue-500 hover:underline">Ajouter</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB: Documents normaux ── */}
      {tab === "documents" && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setFilterCat("all")}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${filterCat === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                Tous
              </button>
              {categories.map(c => (
                <button key={c.id} onClick={() => setFilterCat(filterCat === c.id ? "all" : c.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition flex items-center gap-1.5 ${filterCat === c.id ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  style={filterCat === c.id ? { backgroundColor: c.color } : {}}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {filteredRegular.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
              <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Aucun document trouvé</p>
              <button onClick={() => { setIsCompanyDoc(false); setDocVisibility("all"); setShowModal(true) }}
                className="mt-3 text-sm text-blue-600 hover:underline">
                Ajouter le premier document
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRegular.map(doc => (
                <div key={doc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
                      {fileIcon(doc.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-400 truncate">{doc.file_name}</p>
                      {doc.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doc.description}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {doc.category && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: doc.category.color }}>
                        <Tag className="w-2.5 h-2.5" />
                        {doc.category.name}
                      </span>
                    )}
                    {doc.account && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-medium">
                        {doc.account.name}
                      </span>
                    )}
                    {doc.visibility && doc.visibility !== "all" && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${VISIBILITY_COLORS[doc.visibility]}`}>
                        <Lock className="w-2.5 h-2.5" />
                        {VISIBILITY_LABELS[doc.visibility]}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <div className="text-xs text-gray-400">
                      {formatDate(doc.created_at, "fr")} · {formatSize(doc.file_size)}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <a href={doc.file_url} target="_blank" rel="noreferrer"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      {isAdmin && (
                        <button onClick={() => handleDelete(doc)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
