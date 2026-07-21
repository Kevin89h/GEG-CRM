"use client"

import { useState, useMemo, useRef } from "react"
import Link from "next/link"
import { Plus, Download, Upload, Search, ChevronUp, ChevronDown, X, CreditCard } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { useRouter } from "next/navigation"

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon", pending: "En attente", paid: "Payée", partial: "Partielle", cancelled: "Annulée",
}
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  partial: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-600",
}

type Invoice = {
  id: string; number: string; supplier_name: string; status: string
  currency: string; total_ht: number; total_ttc: number; balance: number
  invoice_date: string; due_date: string | null
}

type SortKey = "number" | "supplier_name" | "invoice_date" | "due_date" | "balance" | "status"

export default function FacturesFournisseursListClient({
  invoices: initial,
  locale,
}: {
  invoices: Invoice[]
  locale: string
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("invoice_date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [invoices, setInvoices] = useState(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(i => i.id)))
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const filtered = useMemo(() => {
    let list = invoices.filter(inv => {
      if (statusFilter && inv.status !== statusFilter) return false
      if (dateFrom && inv.invoice_date < dateFrom) return false
      if (dateTo && inv.invoice_date > dateTo) return false
      if (search) {
        const q = search.toLowerCase()
        if (!inv.number.toLowerCase().includes(q) && !inv.supplier_name.toLowerCase().includes(q)) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? ""
      const bv = b[sortKey] ?? ""
      const cmp = String(av).localeCompare(String(bv), "fr", { numeric: true })
      return sortDir === "asc" ? cmp : -cmp
    })
    return list
  }, [invoices, search, statusFilter, dateFrom, dateTo, sortKey, sortDir])

  const totalPending = filtered.filter(i => i.status === "pending" || i.status === "partial").reduce((s, i) => s + Number(i.balance ?? i.total_ttc), 0)
  const totalPaid = filtered.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total_ttc), 0)

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown className="w-3 h-3 text-gray-300 inline ml-1" />
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-blue-500 inline ml-1" />
      : <ChevronDown className="w-3 h-3 text-blue-500 inline ml-1" />
  }

  function clearFilters() {
    setSearch(""); setStatusFilter(""); setDateFrom(""); setDateTo("")
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) { setImportResult("Fichier vide ou invalide"); setImporting(false); return }

    const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim())
    const rows = lines.slice(1).map(line => {
      const vals = line.match(/("([^"]*)"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) ?? []
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]))
    }).filter(r => Object.values(r).some(v => v))

    const res = await fetch("/api/supplier-invoices/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    })
    const json = await res.json()
    setImporting(false)
    if (!res.ok) { setImportResult(`Erreur : ${json.error}`); return }
    setImportResult(`✓ ${json.imported} facture(s) importée(s)`)
    router.refresh()
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factures fournisseurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez vos achats et dépenses directement</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/comptabilite/paiements-fournisseurs`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <CreditCard className="w-4 h-4" /> Paiements
          </Link>
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" /> Importer CSV
          </button>
          <a
            href="/api/supplier-invoices/export"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Exporter CSV
          </a>
          <Link
            href={`/${locale}/comptabilite/factures-fournisseurs/nouveau`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouvelle facture
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Résultats</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{filtered.length} <span className="text-sm font-normal text-gray-400">/ {invoices.length}</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-amber-500 uppercase tracking-wide">À payer</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{totalPending.toLocaleString("fr")} <span className="text-sm font-normal text-gray-400">GNF</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-emerald-500 uppercase tracking-wide">Payées</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{totalPaid.toLocaleString("fr")} <span className="text-sm font-normal text-gray-400">GNF</span></p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher numéro ou fournisseur..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Du</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span>au</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {(search || statusFilter || dateFrom || dateTo) && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" /> Effacer
          </button>
        )}
      </div>

      {/* Bandeau sous-total sélection */}
      {selected.size > 0 && (() => {
        const selInvoices = filtered.filter(i => selected.has(i.id))
        const byCurrency = selInvoices.reduce<Record<string, number>>((acc, i) => {
          const key = i.currency
          acc[key] = (acc[key] ?? 0) + Number(i.balance ?? i.total_ttc)
          return acc
        }, {})
        return (
          <div className="mb-3 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
            <span className="text-sm font-medium text-blue-700">
              {selected.size} facture{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-4">
              {Object.entries(byCurrency).map(([cur, total]) => (
                <span key={cur} className="text-sm font-bold text-blue-900">
                  {total.toLocaleString("fr")} {cur}
                </span>
              ))}
              <button onClick={() => setSelected(new Set())} className="text-blue-400 hover:text-blue-700 ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      })()}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">Aucune facture trouvée</p>
            <p className="text-sm mt-1">Modifiez vos filtres ou créez une nouvelle facture</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                {([
                  ["number", "Numéro"],
                  ["supplier_name", "Fournisseur"],
                  ["invoice_date", "Date"],
                  ["due_date", "Échéance"],
                  ["balance", "Montant dû"],
                  ["status", "Statut"],
                ] as [SortKey, string][]).map(([k, label]) => (
                  <th
                    key={k}
                    onClick={() => toggleSort(k)}
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-gray-600 select-none ${k === "balance" ? "text-right" : ""}`}
                  >
                    {label}<SortIcon k={k} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(inv => (
                <tr key={inv.id} onClick={() => toggleSelect(inv.id)} className={`cursor-pointer hover:bg-gray-50 transition-colors ${selected.has(inv.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(inv.id)}
                      onChange={() => toggleSelect(inv.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/${locale}/comptabilite/factures-fournisseurs/${inv.id}`} className="font-medium text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{inv.supplier_name}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.invoice_date)}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.due_date ? formatDate(inv.due_date) : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {Number(inv.balance ?? inv.total_ttc).toLocaleString("fr")} {inv.currency}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[inv.status] ?? STATUS_COLOR.draft}`}>
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal import */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Importer des factures CSV</h2>
              <button onClick={() => { setImportOpen(false); setImportResult(null) }} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-700">Colonnes attendues (séparées par virgule) :</p>
              <p className="font-mono text-xs text-gray-500">Fournisseur, Devise, Date, Échéance, Référence, Total HT, TVA, Total TTC</p>
              <p className="text-xs text-gray-400 mt-2">La première ligne doit contenir les en-têtes. Les colonnes <strong>Fournisseur</strong> et <strong>Total TTC</strong> sont obligatoires.</p>
            </div>

            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />

            {importResult && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${importResult.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {importResult}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => { setImportOpen(false); setImportResult(null) }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Fermer
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {importing ? "Import en cours…" : "Choisir un fichier CSV"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
