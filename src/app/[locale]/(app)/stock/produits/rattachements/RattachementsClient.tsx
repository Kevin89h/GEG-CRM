"use client"

// Correspondence of the historical lines: old FREE lines of quotes and invoices (no catalogue product) are
// linked to catalogue fiches in a separate table. The documents are never modified (amounts, VAT, PDF, stock).
// Actions (link, validate, correct, cancel) only with "produits.gerer"; the server checks everything again.
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Search, Link2, Check, RefreshCw, X, ChevronDown, ChevronRight, Info, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { ProductPickerDialog, type CatalogProduct } from "@/components/sales/ProductPicker"
import { formatNumber } from "@/lib/utils"

type LineTable = "invoice_lines" | "sales_order_lines"
type LinkStatus = "proposed" | "validated" | "cancelled"
type Filter = "all" | "unlinked" | "proposed" | "validated"

interface LinkItem {
  id: string
  status: LinkStatus
  source: "manual" | "auto_h4"
  note: string | null
  product: { id: string; name: string; product_type: string | null; is_active: boolean; to_complete: boolean | null } | null
  created_by_name: string | null
  created_at: string
  validated_by_name: string | null
  validated_at: string | null
  cancelled_by_name: string | null
  cancelled_at: string | null
  cancel_reason: string | null
}

interface Row {
  line_table: LineTable
  line_id: string
  document_id: string
  document_number: string | null
  document_status: string | null
  document_kind: "facture" | "devis"
  document_date: string | null
  account: string | null
  currency: string | null
  description: string
  quantity: number
  unit_price: number
  link: LinkItem | null
  history: LinkItem[]
}

interface Summary { total: number; validated: number; proposed: number; unlinked: number }

const INVOICE_STATUS: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyée", partial: "Partielle", paid: "Payée", cancelled: "Annulée",
}
const QUOTE_STATUS: Record<string, string> = {
  draft: "Brouillon", confirmed: "Confirmé", invoiced: "Facturé", cancelled: "Annulé",
}

const PAGE_SIZE = 100

function rowKey(r: Row) { return `${r.line_table}:${r.line_id}` }

function fmtDateTime(value: string | null, locale: string) {
  if (!value) return ""
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
  } catch { return value }
}

function fmtDate(value: string | null, locale: string) {
  if (!value) return ""
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(new Date(value))
  } catch { return value }
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function LinkStatusBadge({ status }: { status: LinkStatus }) {
  if (status === "validated") return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700">validé</span>
  if (status === "proposed") return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-700">proposé</span>
  return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-gray-200 text-gray-600">annulé</span>
}

function ToCompleteBadge() {
  return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">À compléter</span>
}

/** Reason dialog for "Annuler" and "Corriger" */
type ReasonMode = "cancel" | "correct"

export default function RattachementsClient({ canManageInitial, companyName }: { canManageInitial: boolean; companyName: string }) {
  const params = useParams()
  const locale = params.locale as string

  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, validated: 0, proposed: 0, unlinked: 0 })
  const [canManage, setCanManage] = useState(canManageInitial)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionInfo, setActionInfo] = useState<string | null>(null)

  // Picker: "link" = new link on an unlinked line; "correct" = cancel the current link then create a new one
  const [picker, setPicker] = useState<{ row: Row; mode: "link" | "correct"; reason?: string } | null>(null)
  const [reasonFor, setReasonFor] = useState<{ row: Row; mode: ReasonMode } | null>(null)
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/produits/rattachements?status=all", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadError(json.error ?? `Erreur de chargement (${res.status})`)
        return
      }
      setRows((json.rows ?? []) as Row[])
      if (json.summary) setSummary(json.summary as Summary)
      if (typeof json.canManage === "boolean") setCanManage(json.canManage)
    } catch {
      setLoadError("Erreur réseau : impossible de charger les lignes.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = normalize(search.trim())
    return rows.filter(r => {
      const matchFilter =
        filter === "all" ? true :
        filter === "unlinked" ? !r.link :
        r.link?.status === filter
      if (!matchFilter) return false
      if (!q) return true
      return normalize(r.description ?? "").includes(q)
    })
  }, [rows, filter, search])

  const shown = filtered.slice(0, limit)

  function toggleExpanded(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function postLink(row: Row, product: CatalogProduct): Promise<string | null> {
    const res = await fetch("/api/produits/rattachements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line_table: row.line_table, line_id: row.line_id, product_id: product.id }),
    })
    const json = await res.json().catch(() => ({}))
    return res.ok ? null : (json.error ?? `Erreur (${res.status})`)
  }

  async function patchLink(linkId: string, body: Record<string, unknown>): Promise<string | null> {
    const res = await fetch(`/api/produits/rattachements/${linkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    return res.ok ? null : (json.error ?? `Erreur (${res.status})`)
  }

  function clearMessages() { setActionError(null); setActionInfo(null) }

  async function onPicked(product: CatalogProduct) {
    if (!picker) return
    const { row, mode, reason: correctReason } = picker
    const key = rowKey(row)
    clearMessages()
    setBusyKey(key)
    try {
      if (mode === "correct" && row.link) {
        // Correction = cancel the current link (kept in the history), then create the new one
        const err = await patchLink(row.link.id, { action: "cancel", reason: correctReason ?? "" })
        if (err) { setActionError(`Correction impossible : ${err}`); return }
        const err2 = await postLink(row, product)
        if (err2) {
          setActionError(`L'ancienne correspondance a été annulée, mais la nouvelle n'a pas pu être enregistrée : ${err2}. Utilisez « Rattacher » sur cette ligne pour réessayer.`)
          return
        }
        setActionInfo(`Correspondance corrigée : « ${row.description} » → ${product.name}.`)
      } else {
        const err = await postLink(row, product)
        if (err) { setActionError(`Rattachement impossible : ${err}`); return }
        setActionInfo(`Ligne rattachée : « ${row.description} » → ${product.name}.`)
      }
    } catch {
      setActionError("Erreur réseau : l'action n'a pas pu être enregistrée.")
    } finally {
      setBusyKey(null)
      await load()
    }
  }

  async function validate(row: Row) {
    if (!row.link) return
    clearMessages()
    setBusyKey(rowKey(row))
    try {
      const err = await patchLink(row.link.id, { action: "validate" })
      if (err) setActionError(`Validation impossible : ${err}`)
      else setActionInfo(`Correspondance validée : « ${row.description} » → ${row.link.product?.name ?? "fiche"}.`)
    } catch {
      setActionError("Erreur réseau : l'action n'a pas pu être enregistrée.")
    } finally {
      setBusyKey(null)
      await load()
    }
  }

  function openReason(row: Row, mode: ReasonMode) {
    clearMessages()
    setReason("")
    setReasonError(null)
    setReasonFor({ row, mode })
  }

  async function confirmReason() {
    if (!reasonFor) return
    const text = reason.trim()
    if (text.length < 5) { setReasonError("Indiquez un motif d'au moins 5 caractères."); return }
    const { row, mode } = reasonFor
    if (mode === "correct") {
      // The current link is cancelled only once the new fiche is chosen (nothing changes if the picker is closed)
      setReasonFor(null)
      setPicker({ row, mode: "correct", reason: text })
      return
    }
    if (!row.link) return
    setBusyKey(rowKey(row))
    try {
      const err = await patchLink(row.link.id, { action: "cancel", reason: text })
      if (err) { setReasonError(err); return }
      setReasonFor(null)
      setActionInfo(`Correspondance annulée (gardée dans l'historique) : « ${row.description} ».`)
      await load()
    } catch {
      setReasonError("Erreur réseau : l'annulation n'a pas pu être enregistrée.")
    } finally {
      setBusyKey(null)
    }
  }

  const TABS: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Toutes", count: summary.total },
    { key: "unlinked", label: "À rattacher", count: summary.unlinked },
    { key: "proposed", label: "Proposées", count: summary.proposed },
    { key: "validated", label: "Validées", count: summary.validated },
  ]

  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <Link href={`/${locale}/stock/produits`} className="mt-1.5 text-gray-400 hover:text-gray-600 transition" title="Retour au catalogue">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Correspondance des lignes historiques</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Anciennes lignes libres des devis et factures, à relier aux fiches du catalogue
            <span className="mx-1.5 text-gray-300">·</span>
            <span className="text-gray-400">Catalogue — {companyName}</span>
          </p>
        </div>
        <button
          onClick={() => { clearMessages(); load() }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {/* Explanation */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
        <div className="space-y-1">
          <p>
            Les anciens devis et factures <strong>ne sont jamais modifiés</strong> : montants, TVA, PDF et stock restent identiques.
          </p>
          <p>
            Cette page sert uniquement à indiquer à quelle fiche du catalogue correspond chaque ancienne ligne libre.
            Chaque correspondance garde son auteur et sa date. Une correspondance annulée reste visible dans l&apos;historique.
          </p>
          {!canManage && (
            <p className="text-blue-700">Consultation seule : seules les personnes autorisées à gérer les produits peuvent rattacher, valider ou corriger.</p>
          )}
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Lignes au total", value: summary.total, color: "text-gray-900" },
          { label: "Validées", value: summary.validated, color: "text-emerald-600" },
          { label: "Proposées", value: summary.proposed, color: "text-blue-600" },
          { label: "À rattacher", value: summary.unlinked, color: summary.unlinked > 0 ? "text-orange-600" : "text-gray-400" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
            <div className={`text-xl font-bold ${c.color}`}>{formatNumber(c.value)}</div>
            <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setLimit(PAGE_SIZE) }}
            placeholder="Rechercher dans le libellé…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {TABS.map(tb => (
            <button
              key={tb.key}
              onClick={() => { setFilter(tb.key); setLimit(PAGE_SIZE) }}
              className={`px-3 py-2 text-xs rounded-lg font-medium transition ${filter === tb.key ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {tb.label} ({tb.count})
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}
      {actionInfo && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <span>{actionInfo}</span>
          <button onClick={() => setActionInfo(null)} className="opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      ) : loading && rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Link2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucune ligne pour ce filtre.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Document</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Libellé de la ligne</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Qté</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Prix unitaire</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fiche du catalogue</th>
                {canManage && <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shown.map(r => {
                const key = rowKey(r)
                const busy = busyKey === key
                const isOpen = expanded.has(key)
                const statusLabel = r.document_status
                  ? (r.document_kind === "facture" ? INVOICE_STATUS : QUOTE_STATUS)[r.document_status] ?? r.document_status
                  : null
                const docHref = r.document_kind === "facture"
                  ? `/${locale}/ventes/factures/${r.document_id}`
                  : `/${locale}/ventes/devis/${r.document_id}`
                const l = r.link
                return (
                  <Fragment key={key}>
                    <tr className={`align-top ${busy ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <a href={docHref} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-blue-700 hover:underline">
                          {r.document_number ?? "(sans numéro)"} <ExternalLink className="w-3 h-3" />
                        </a>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {r.document_kind === "facture" ? "Facture" : "Devis"}
                          {statusLabel ? ` · ${statusLabel}` : ""}
                        </div>
                        {r.document_date && <div className="text-xs text-gray-400">{fmtDate(r.document_date, locale)}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.account ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-900 max-w-xs">
                        <span className="whitespace-pre-line">{r.description}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{formatNumber(r.quantity)}</td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                        {formatNumber(r.unit_price)} {r.currency ?? ""}
                      </td>
                      <td className="px-4 py-3 min-w-[14rem]">
                        {l ? (
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {l.product ? (
                                <a href={`/${locale}/stock/produits/${l.product.id}`} target="_blank" rel="noopener noreferrer"
                                  className="font-medium text-gray-900 hover:text-blue-700 hover:underline">
                                  {l.product.name}
                                </a>
                              ) : <span className="text-gray-500 italic">Fiche introuvable</span>}
                              <LinkStatusBadge status={l.status} />
                              {l.product?.to_complete && <ToCompleteBadge />}
                              {l.product && !l.product.is_active && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-gray-200 text-gray-700">Désactivé</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {l.status === "validated" && l.validated_by_name && l.validated_by_name !== l.created_by_name
                                ? <>Proposé par {l.created_by_name ?? "—"} le {fmtDateTime(l.created_at, locale)} · validé par {l.validated_by_name} le {fmtDateTime(l.validated_at, locale)}</>
                                : <>Par {l.created_by_name ?? "—"} le {fmtDateTime(l.created_at, locale)}</>}
                            </div>
                            {l.note && <div className="text-xs text-gray-500 italic mt-0.5">{l.note}</div>}
                          </div>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">À rattacher</span>
                        )}
                        {r.history.length > 0 && (
                          <button onClick={() => toggleExpanded(key)}
                            className="mt-1.5 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            Historique ({r.history.length})
                          </button>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex flex-col items-end gap-1.5">
                            {!l && (
                              <button disabled={busy} onClick={() => { clearMessages(); setPicker({ row: r, mode: "link" }) }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
                                <Link2 className="w-3.5 h-3.5" /> Rattacher
                              </button>
                            )}
                            {l?.status === "proposed" && (
                              <button disabled={busy} onClick={() => validate(r)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                                <Check className="w-3.5 h-3.5" /> Valider
                              </button>
                            )}
                            {l && (
                              <button disabled={busy} onClick={() => openReason(r, "correct")}
                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                                Corriger
                              </button>
                            )}
                            {l && (
                              <button disabled={busy} onClick={() => openReason(r, "cancel")}
                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-red-200 text-red-600 bg-white hover:bg-red-50 disabled:opacity-50">
                                Annuler
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                    {isOpen && r.history.length > 0 && (
                      <tr className="bg-gray-50/60">
                        <td colSpan={canManage ? 7 : 6} className="px-4 py-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historique de la ligne</p>
                          <ul className="space-y-2">
                            {[...r.history].reverse().map(h => (
                              <li key={h.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-medium ${h.status === "cancelled" ? "text-gray-500 line-through" : "text-gray-900"}`}>
                                    {h.product?.name ?? "Fiche introuvable"}
                                  </span>
                                  <LinkStatusBadge status={h.status} />
                                  {h.product?.to_complete && <ToCompleteBadge />}
                                  {h.source === "auto_h4" && <span className="text-[11px] text-gray-400">(proposition automatique)</span>}
                                </div>
                                <div className="mt-0.5">Créé par {h.created_by_name ?? "—"} le {fmtDateTime(h.created_at, locale)}</div>
                                {h.validated_at && <div>Validé par {h.validated_by_name ?? "—"} le {fmtDateTime(h.validated_at, locale)}</div>}
                                {h.cancelled_at && (
                                  <div className="text-red-700">
                                    Annulé par {h.cancelled_by_name ?? "—"} le {fmtDateTime(h.cancelled_at, locale)}
                                    {h.cancel_reason ? ` — motif : ${h.cancel_reason}` : ""}
                                  </div>
                                )}
                                {h.note && <div className="italic">Note : {h.note}</div>}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {filtered.length > shown.length && (
            <div className="border-t border-gray-100 px-4 py-3 text-center">
              <button onClick={() => setLimit(n => n + PAGE_SIZE)} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                Afficher plus ({filtered.length - shown.length} restantes)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reason (cancel / correct) */}
      <Modal
        open={!!reasonFor}
        onClose={() => { if (!busyKey) setReasonFor(null) }}
        title={reasonFor?.mode === "correct" ? "Corriger la correspondance" : "Annuler la correspondance"}
      >
        {reasonFor && (
          <div className="p-6 space-y-4">
            <div className="text-sm text-gray-700 space-y-1">
              <p>Ligne : <strong>{reasonFor.row.description}</strong></p>
              <p>Fiche actuelle : <strong>{reasonFor.row.link?.product?.name ?? "—"}</strong></p>
              <p className="text-gray-500 text-xs">
                {reasonFor.mode === "correct"
                  ? "Vous choisirez ensuite la bonne fiche. L'ancienne correspondance sera annulée et gardée dans l'historique avec ce motif."
                  : "La correspondance sera annulée et gardée dans l'historique avec ce motif. La ligne redeviendra « à rattacher »."}
                {" "}Le document lui-même n&apos;est pas modifié.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif <span className="text-red-500">*</span></label>
              <textarea
                autoFocus
                value={reason}
                onChange={e => { setReason(e.target.value); setReasonError(null) }}
                rows={3}
                placeholder="ex : mauvaise marque, mauvais conditionnement…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">5 caractères minimum.</p>
            </div>
            {reasonError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{reasonError}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setReasonFor(null)} disabled={!!busyKey}>Fermer</Button>
              <Button onClick={confirmReason} disabled={!!busyKey || reason.trim().length < 5}>
                {busyKey ? "…" : reasonFor.mode === "correct" ? "Choisir la nouvelle fiche" : "Annuler la correspondance"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Catalogue picker */}
      <ProductPickerDialog
        open={!!picker}
        onClose={() => setPicker(null)}
        title={picker?.mode === "correct" ? "Choisir la bonne fiche du catalogue" : "Rattacher à une fiche du catalogue"}
        locale={locale}
        initialQuery={picker?.row.description.slice(0, 80) ?? ""}
        currency={picker?.row.currency ?? "GNF"}
        onSelect={p => { void onPicked(p) }}
      />
    </div>
  )
}
