"use client"

// Catalogue picker for quote and invoice lines (R1/H1: no free line, every line is an active product or service).
// Searches /api/produits/recherche (close matches with the reasons that make them similar or distinct),
// shows the "not found" message of the server, and lets users holding "produits.gerer" create a new
// sheet inline after an anti-duplicate check (R6). Never shows purchase prices.
import { useEffect, useRef, useState } from "react"
import { ExternalLink, Search, X, Plus, Ban } from "lucide-react"
import { usePerms } from "@/components/PermissionsProvider"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatNumber } from "@/lib/utils"

export interface CatalogProduct {
  id: string
  name: string
  reference: string | null
  product_code: string | null
  merchant_reference: string | null
  product_type: string | null
  is_active: boolean
  category: string | null
  unit: string | null
  packagings: string[]
  sell_price: number | null
  currency: string | null
  score?: number
  reasons?: string[]
}

interface SearchResponse { query: string; results: CatalogProduct[]; notFoundMessage: string | null }

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  storable: "Marchandise",
  service: "Service",
  consumable: "Consommable",
}

export function productTypeLabel(type: string | null | undefined): string {
  return PRODUCT_TYPE_LABELS[type ?? ""] ?? "Marchandise"
}

async function searchCatalog(q: string, signal?: AbortSignal): Promise<SearchResponse> {
  const res = await fetch(`/api/produits/recherche?q=${encodeURIComponent(q)}`, { signal })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Erreur de recherche (${res.status})`)
  return { query: json.query ?? q, results: json.results ?? [], notFoundMessage: json.notFoundMessage ?? null }
}

interface ProductPickerProps {
  locale: string
  onSelect: (product: CatalogProduct) => void
  placeholder?: string
  initialQuery?: string
  /** Currency proposed for the sell price of a new sheet */
  currency?: string
  autoFocus?: boolean
}

export default function ProductPicker({ locale, onSelect, placeholder, initialQuery = "", currency = "GNF", autoFocus = true }: ProductPickerProps) {
  const { can } = usePerms()
  const canCreate = can("produits.gerer")
  const [query, setQuery] = useState(initialQuery)
  // Last answer (or error) with the query it belongs to; what is shown is derived from the current query
  const [answer, setAnswer] = useState<{ q: string; data: SearchResponse | null; error: string | null } | null>(null)
  const [creating, setCreating] = useState(false)
  const q = query.trim()

  // Debounced search; an aborted request never overwrites a newer one
  useEffect(() => {
    if (q.length < 2) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      searchCatalog(q, ctrl.signal)
        .then(r => setAnswer({ q, data: r, error: null }))
        .catch(e => { if (!ctrl.signal.aborted) setAnswer({ q, data: null, error: e instanceof Error ? e.message : "Erreur de recherche" }) })
    }, 300)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [q])

  const current = q.length >= 2 && answer?.q === q ? answer : null
  const loading = q.length >= 2 && !current
  const data = current?.data ?? null
  const searchError = current?.error ?? null
  const results = data?.results ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={e => { setQuery(e.target.value); setCreating(false) }}
          placeholder={placeholder ?? "Rechercher un produit ou un service (désignation, référence, code)…"}
          className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
        />
        {loading && <span className="text-xs text-gray-400">Recherche…</span>}
        {query && (
          <button type="button" onClick={() => { setQuery(""); setCreating(false) }} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="text-xs text-gray-400">Saisissez au moins 2 caractères.</p>
      )}
      {searchError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{searchError}</p>}

      {data && !creating && (
        <>
          {data.notFoundMessage && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 whitespace-pre-line">
              {data.notFoundMessage}
            </div>
          )}

          {results.length > 0 && (
            <div>
              {data.notFoundMessage && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Articles similaires</p>}
              <CandidateList locale={locale} items={results} onSelect={onSelect} />
            </div>
          )}

          {results.length === 0 && !data.notFoundMessage && (
            <p className="text-sm text-gray-400">Aucun résultat.</p>
          )}

          {/* Creating a sheet is always possible (a genuinely different product), but gated by "produits.gerer" (R6) */}
          {canCreate ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                <Plus className="w-4 h-4" /> Créer une nouvelle fiche
              </button>
            </div>
          ) : data.notFoundMessage ? (
            <AccessRequest />
          ) : null}
        </>
      )}

      {creating && canCreate && (
        <CreateProductForm
          locale={locale}
          initialName={query.trim()}
          currency={currency}
          onCancel={() => setCreating(false)}
          onCreated={p => { setCreating(false); onSelect(p) }}
          onSelectExisting={p => { setCreating(false); onSelect(p) }}
        />
      )}
    </div>
  )
}

/* --- Result list ------------------------------------------- */
function CandidateList({ locale, items, onSelect }: { locale: string; items: CatalogProduct[]; onSelect: (p: CatalogProduct) => void }) {
  return (
    <ul className="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-80 overflow-y-auto">
      {items.map(p => (
        <li key={p.id} className={`px-3 py-2.5 flex items-start gap-3 ${p.is_active ? "" : "bg-gray-50 opacity-60"}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-900">{p.name}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${p.product_type === "service" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-600"}`}>
                {productTypeLabel(p.product_type)}
              </span>
              {!p.is_active && (
                <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-medium">
                  <Ban className="w-3 h-3" /> désactivé — non sélectionnable
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {[
                p.reference && `Réf. ${p.reference}`,
                p.product_code && `Code ${p.product_code}`,
                p.merchant_reference && `Réf. marchand ${p.merchant_reference}`,
                p.category && `Catégorie : ${p.category}`,
                p.unit && `Unité : ${p.unit}`,
                p.packagings.length > 0 && `Conditionnements : ${p.packagings.join(", ")}`,
                p.sell_price != null && `Prix de vente : ${formatNumber(p.sell_price)} ${p.currency ?? ""}`.trim(),
              ].filter(Boolean).join(" · ")}
            </p>
            {p.reasons && p.reasons.length > 0 && (
              <p className="text-xs text-blue-700 mt-0.5">{p.reasons.join(" · ")}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              type="button"
              onClick={() => p.is_active && onSelect(p)}
              disabled={!p.is_active}
              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Sélectionner
            </button>
            <a
              href={`/${locale}/stock/produits/${p.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
            >
              Voir la fiche <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </li>
      ))}
    </ul>
  )
}

/* --- Access request (no "produits.gerer") ------------------- */
function AccessRequest() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "already" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  async function request() {
    setState("sending"); setMessage(null)
    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "stock", permission: "produits.gerer" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setState("error"); setMessage(json.error ?? `Erreur (${res.status})`); return }
      setState(json.already ? "already" : "sent")
    } catch {
      setState("error"); setMessage("Erreur réseau")
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 space-y-2">
      <p>
        Vos permissions ne permettent pas de créer une fiche produit ou service.
        Demandez l&apos;accès, ou demandez à une personne habilitée (gestion des produits) de créer la fiche,
        puis reprenez votre document.
      </p>
      {state === "sent" && <p className="text-emerald-700">Demande envoyée aux administrateurs.</p>}
      {state === "already" && <p className="text-amber-700">Une demande a déjà été envoyée récemment (moins de 24 h).</p>}
      {state === "error" && <p className="text-red-600">{message}</p>}
      {state !== "sent" && state !== "already" && (
        <button
          type="button"
          onClick={request}
          disabled={state === "sending"}
          className="px-3 py-1.5 text-xs font-semibold rounded-md border border-blue-200 text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-50"
        >
          {state === "sending" ? "Envoi…" : "Demander l'accès"}
        </button>
      )}
    </div>
  )
}

/* --- Inline creation (R6) with anti-duplicate check --------- */
function CreateProductForm({ locale, initialName, currency, onCancel, onCreated, onSelectExisting }: {
  locale: string
  initialName: string
  currency: string
  onCancel: () => void
  onCreated: (p: CatalogProduct) => void
  onSelectExisting: (p: CatalogProduct) => void
}) {
  const [form, setForm] = useState({
    product_type: "" as "" | "storable" | "service",
    name: initialName,
    reference: "",
    category_id: "",
    unit_id: "",
    sell_price: "",
  })
  const [units, setUnits] = useState<{ id: string; name: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Anti-duplicate check: similar items found for the typed designation, confirmed by the user
  const [similar, setSimilar] = useState<CatalogProduct[] | null>(null)
  const [checkedName, setCheckedName] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const { db } = getCompanyClientBrowser()
    Promise.all([
      db.from("units").select("id, name").order("name"),
      db.from("product_categories").select("id, name").order("name"),
    ]).then(([u, c]) => {
      setUnits((u.data ?? []) as { id: string; name: string }[])
      setCategories((c.data ?? []) as { id: string; name: string }[])
    })
  }, [])

  function setF<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }))
    if (k === "name") { setSimilar(null); setCheckedName(null) }
  }

  async function submit(confirmedDistinct: boolean) {
    setError(null)
    if (!form.product_type) { setError("Choisissez le type : marchandise ou service."); return }
    const name = form.name.trim()
    if (!name) { setError("La désignation est obligatoire."); nameRef.current?.focus(); return }

    // Step 1: show the similar items for the typed designation before creating (anti-duplicate)
    if (!confirmedDistinct || checkedName !== name) {
      setSaving(true)
      try {
        const r = await searchCatalog(name)
        if (r.results.length > 0) { setSimilar(r.results); setCheckedName(name); return }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de recherche"); return
      } finally {
        setSaving(false)
      }
    }

    // Step 2: create the sheet
    setSaving(true)
    try {
      const res = await fetch("/api/stock/produits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          reference: form.reference.trim() || null,
          category_id: form.category_id || null,
          unit_id: form.unit_id || null,
          sell_price: form.sell_price ? parseFloat(form.sell_price) : null,
          currency,
          product_type: form.product_type,
          is_active: true,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.id) { setError(json.error ?? `Erreur lors de la création (${res.status})`); return }

      // The creation route may ignore the type: set it explicitly when it differs
      let productType: string = json.product_type ?? ""
      if (productType !== form.product_type) {
        const r2 = await fetch(`/api/stock/produits/${json.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_type: form.product_type }),
        })
        if (!r2.ok) {
          const j2 = await r2.json().catch(() => ({}))
          setError(`Fiche créée, mais le type n'a pas pu être enregistré : ${j2.error ?? r2.status}. Corrigez-le sur la fiche produit.`)
          return
        }
        productType = form.product_type
      }

      const unitName = (Array.isArray(json.unit) ? json.unit[0] : json.unit)?.name ?? units.find(u => u.id === form.unit_id)?.name ?? null
      const categoryName = (Array.isArray(json.category) ? json.category[0] : json.category)?.name ?? categories.find(c => c.id === form.category_id)?.name ?? null
      onCreated({
        id: json.id,
        name: json.name,
        reference: json.reference ?? null,
        product_code: json.product_code ?? null,
        merchant_reference: json.merchant_reference ?? null,
        product_type: productType,
        is_active: json.is_active ?? true,
        category: categoryName,
        unit: unitName,
        packagings: [],
        sell_price: json.sell_price ?? null,
        currency: json.currency ?? currency,
      })
    } catch {
      setError("Erreur réseau lors de la création")
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelCls = "block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-800">Nouvelle fiche produit ou service</p>

      <div>
        <span className={labelCls}>Type *</span>
        <div className="grid grid-cols-2 gap-2">
          {([{ v: "storable", l: "Marchandise" }, { v: "service", l: "Service" }] as const).map(({ v, l }) => (
            <button key={v} type="button" onClick={() => setF("product_type", v)}
              className={`py-2 text-sm font-medium rounded-lg border transition-colors ${form.product_type === v ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
            >{l}</button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Désignation *</label>
        <input ref={nameRef} value={form.name} onChange={e => setF("name", e.target.value)} className={inputCls} placeholder="Ex : Huile moteur 15W40 fût 205L" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Référence</label>
          <input value={form.reference} onChange={e => setF("reference", e.target.value)} className={inputCls} placeholder="Ex : LUB-15W40-205" />
        </div>
        <div>
          <label className={labelCls}>Catégorie</label>
          <select value={form.category_id} onChange={e => setF("category_id", e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">—</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Unité</label>
          <select value={form.unit_id} onChange={e => setF("unit_id", e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">—</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Prix de vente ({currency})</label>
          <input type="number" min="0" step="any" value={form.sell_price} onChange={e => setF("sell_price", e.target.value)} className={inputCls} placeholder="0" />
        </div>
      </div>

      {similar && similar.length > 0 && checkedName === form.name.trim() && (
        <div className="space-y-2">
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Vérifiez les articles similaires avant de créer la fiche, afin d&apos;éviter les doublons.
            Si l&apos;un d&apos;eux correspond, sélectionnez-le ; sinon confirmez la création.
          </div>
          <CandidateList locale={locale} items={similar} onSelect={onSelectExisting} />
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 bg-white hover:bg-gray-50">
          Annuler
        </button>
        {similar && similar.length > 0 && checkedName === form.name.trim() ? (
          <button type="button" onClick={() => submit(true)} disabled={saving}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40">
            {saving ? "Création…" : "Aucun de ces articles ne correspond — créer la fiche"}
          </button>
        ) : (
          <button type="button" onClick={() => submit(false)} disabled={saving}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40">
            {saving ? "Vérification…" : "Vérifier et créer"}
          </button>
        )}
      </div>
    </div>
  )
}

/* --- Dialog wrapper ------------------------------------------ */
/** The picker inside an overlay (keeps the document underneath and its unsaved input intact) */
export function ProductPickerDialog({ open, onClose, title = "Choisir un produit ou un service", ...props }: ProductPickerProps & {
  open: boolean
  onClose: () => void
  title?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 z-10 my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <ProductPicker {...props} onSelect={p => { props.onSelect(p); onClose() }} />
      </div>
    </div>
  )
}
