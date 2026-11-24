"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Printer, Download, Share2, CheckCircle, Truck, X, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Select"
import { Modal } from "@/components/ui/Modal"
import { formatDate } from "@/lib/utils"
import { deliveryLineKind, suggestProducts } from "@/lib/delivery-rules"


interface DNLine {
  id: string
  product_id: string | null
  description: string
  quantity: number
  warehouse_id: string | null
  position: number
  // "comment": text only copied from the source document (no quantity, warehouse nor stock move)
  line_type?: string | null
  print_on_delivery?: boolean | null
  /** type of the linked catalogue sheet: "service" lines never move stock */
  product_type?: string | null
  invoice_line_id?: string | null
  product_code?: string | null
  brand?: string | null
  packaging?: string | null
  unit?: string | null
  /** part of another line delivered from another warehouse (Q3: one line per warehouse) */
  split_of?: string | null
}

interface CatalogueProduct { id: string; name: string; reference: string | null; product_type: string | null }

const isComment = (l: { line_type?: string | null }) => l.line_type === "comment"

interface DN {
  id: string
  number: string
  status: string
  invoice_id: string | null
  delivery_date: string | null
  notes: string | null
  created_at: string
  account_name: string | null
}

interface Warehouse { id: string; name: string; city: string | null; kind?: string }
interface StockLevel { product_id: string; warehouse_id: string; quantity: number }
type Remaining = Record<string, { invoiced: number; delivered: number; remaining: number; direct: number }>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { dn: DN; lines: DNLine[]; warehouses: Warehouse[]; locale: string; docSettings?: Record<string, any>; products?: CatalogueProduct[]; stock?: StockLevel[]; remaining?: Remaining }

const statusConfig: Record<string, { label: string; color: string }> = {
  draft:     { label: "En cours", color: "bg-amber-100 text-amber-700" },
  delivered: { label: "Livré",    color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Annulé",   color: "bg-red-100 text-red-600" },
}

export default function BonLivraisonClient({ dn, lines: initialLines, warehouses: allWarehouses, locale, docSettings = {}, products = [], stock = [], remaining = {} }: Props) {
  const router = useRouter()
  // production role model: every user of the company may prepare, link and confirm a delivery note (as today)
  const can = (k: string) => !!k
  // GEG 24/11/2026: the user chooses the warehouse(s) of each line; nothing is chosen nor split automatically
  const warehouses = allWarehouses.filter(w => w.kind !== "direct")
  const directWarehouse = allWarehouses.find(w => w.kind === "direct") ?? null
  const [lines, setLines] = useState<DNLine[]>(() =>
    initialLines.map(l => ({ ...l, warehouse_id: isComment(l) ? null : (l.warehouse_id || null) }))
  )
  const qtyIn = (productId: string | null | undefined, warehouseId: string) => stock.find(s => s.product_id === productId && s.warehouse_id === warehouseId)?.quantity ?? 0
  const totalStock = (productId: string | null | undefined) => warehouses.reduce((s, w) => s + qtyIn(productId, w.id), 0)
  const fmtQ = (n: number) => Number(n).toLocaleString("fr")
  const [splitSeq, setSplitSeq] = useState(0)
  function splitLine(source: DNLine) {
    const id = `split-${splitSeq}`
    setSplitSeq(n => n + 1)
    setLines(prev => {
      const i = prev.findIndex(l => l.id === source.id)
      const part: DNLine = { ...source, id, split_of: source.split_of ?? source.id, quantity: 0, warehouse_id: null }
      return [...prev.slice(0, i + 1), part, ...prev.slice(i + 1)]
    })
    setShortages(null)
  }
  function removeSplit(id: string) { setLines(prev => prev.filter(l => l.id !== id)); setShortages(null) }
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defaultWarehouse, setDefaultWarehouse] = useState("")
  // Stock shortages returned by the server: the delivery is refused (no derogation, no negative stock — decision Q1)
  const [shortages, setShortages] = useState<Shortage[] | null>(null)

  const isDraft = dn.status === "draft"
  // Display only (D2): cancel before delivery needs "livraisons.annuler", confirm needs "livraisons.confirmer".
  // Quantities and warehouses are only sent by the confirmation, so they are editable with it.
  const canCancel = isDraft && can("livraisons.annuler")
  const canConfirm = isDraft && can("livraisons.confirmer")
  // a line without a catalogue sheet is NOT a service: it must be linked before validation (regression 17/11/2026)
  const canLink = isDraft && (can("livraisons.creer") || can("livraisons.confirmer"))
  const kind = (l: DNLine) => deliveryLineKind(l)
  const unlinkedLines = lines.filter(l => kind(l) === "unlinked" && Number(l.quantity) > 0)
  const stockLines = lines.filter(l => kind(l) === "product")
  const [linking, setLinking] = useState<string | null>(null)
  const [linkInfo, setLinkInfo] = useState<string | null>(null)

  async function linkLine(lineId: string, productId: string) {
    if (!productId) return
    setLinking(lineId); setError(null); setLinkInfo(null)
    const res = await fetch(`/api/bons-livraison/${dn.id}/lines/${lineId}/link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: productId }) })
    const json = await res.json().catch(() => ({}))
    setLinking(null)
    if (!res.ok) { setError(json.error ?? "Rattachement impossible"); return }
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, product_id: productId, product_type: json.product?.product_type ?? null } : l))
    setShortages(null)
    setLinkInfo(`« ${json.product?.name} » rattachée${json.correspondence ? ` — ${json.correspondence}` : ""}`)
  }

  function setLineWarehouse(lineId: string, warehouseId: string) {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, warehouse_id: warehouseId } : l))
    setShortages(null)
  }

  function setLineQuantity(lineId: string, value: string) {
    const qty = parseFloat(value) || 0
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, quantity: qty } : l))
    // The previous stock check no longer matches the edited lines
    setShortages(null)
  }

  // Appliquer l'entrepôt par défaut à toutes les lignes sans entrepôt
  function applyDefaultWarehouse(wid: string) {
    setDefaultWarehouse(wid)
    setLines(prev => prev.map(l => isComment(l) ? l : ({ ...l, warehouse_id: l.warehouse_id || wid })))
  }

  async function confirmDelivery() {
    if (unlinkedLines.length) {
      setError("Rattachez d'abord chaque ligne à sa fiche du catalogue.")
      return
    }
    if (stockLines.some(l => !l.warehouse_id)) {
      setError("Assigne un entrepôt à chaque produit avant de confirmer.")
      return
    }

    setSaving(true)
    setError(null)
    const res = await fetch(`/api/bons-livraison/${dn.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Comment lines never move stock: they are not sent. Split parts are sent apart (the server creates them).
      body: JSON.stringify({
        lines: lines.filter(l => !isComment(l) && !l.split_of).map(l => ({ id: l.id, quantity: l.quantity, warehouse_id: l.warehouse_id })),
        splits: lines.filter(l => l.split_of).map(l => ({ split_of: l.split_of, quantity: l.quantity, warehouse_id: l.warehouse_id })),
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      // Stock shortage: detailed panel on the page instead of a bare error
      if (Array.isArray(json.shortages) && json.shortages.length > 0) {
        setShortages(json.shortages.map((s: Shortage) => ({ ...s, result: Number(s.available) - Number(s.requested) })))
        setConfirmOpen(false)
      }
      setError(json.error ?? "Erreur lors de la confirmation")
      setSaving(false)
      return
    }

    setConfirmOpen(false)
    setShortages(null)
    setSaving(false)
    router.refresh()
  }

  async function cancel() {
    if (!window.confirm("Annuler ce bon de livraison ?")) return
    const res = await fetch(`/api/bons-livraison/${dn.id}/cancel`, { method: "POST" })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? "Erreur lors de l'annulation")
      return
    }
    router.refresh()
  }

  const warehouseLabel = (wid: string | null) => {
    if (!wid) return "—"
    const w = warehouses.find(x => x.id === wid)
    return w ? (w.city ? `${w.name} — ${w.city}` : w.name) : "—"
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href={dn.invoice_id ? `/${locale}/ventes/factures/${dn.invoice_id}` : `/${locale}/ventes/factures`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {dn.invoice_id ? "Retour à la facture" : "Retour aux factures"}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{dn.number}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusConfig[dn.status]?.color}`}>
              {statusConfig[dn.status]?.label}
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            {dn.account_name && <><strong>{dn.account_name}</strong> · </>}
            Créé le {formatDate(dn.created_at, locale)}
            {dn.delivery_date && <> · Livré le <strong>{formatDate(dn.delivery_date, locale)}</strong></>}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/bons-livraison/${dn.id}/pdf`}
            download={`BL ${dn.number}.pdf`}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" /> Télécharger
          </a>
          <button
            onClick={async () => {
              const url = `${window.location.origin}/api/bons-livraison/${dn.id}/pdf`
              if (navigator.share) {
                try {
                  const res = await fetch(url)
                  const blob = await res.blob()
                  const file = new File([blob], `BL ${dn.number}.pdf`, { type: "application/pdf" })
                  await navigator.share({ files: [file], title: `BL ${dn.number}` })
                } catch { /* annulé */ }
              } else {
                window.open(url, "_blank")
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <Share2 className="w-4 h-4" /> Partager
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" /> Imprimer
          </button>
          {canCancel && (
            <Button variant="secondary" onClick={cancel} className="text-red-500 border-red-200 hover:bg-red-50">
              <X className="w-4 h-4" /> Annuler
            </Button>
          )}
          {canConfirm && (
            <Button onClick={() => setConfirmOpen(true)} disabled={unlinkedLines.length > 0} title={unlinkedLines.length ? "Rattachez d'abord les lignes au catalogue" : undefined}>
              <Truck className="w-4 h-4" /> Confirmer la livraison
            </Button>
          )}
          {dn.status === "delivered" && (
            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm px-3 py-2 bg-emerald-50 rounded-lg">
              <CheckCircle className="w-4 h-4" /> Livraison confirmée — stock sorti
            </div>
          )}
        </div>
      </div>

      {/* Entrepôt par défaut (draft seulement) */}
      {canConfirm && warehouses.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-6 flex items-center gap-4">
          <Truck className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700 flex-1">Appliquer un dépôt aux lignes qui n&apos;en ont pas encore (choix manuel) :</p>
          <div className="w-64">
            <select
              value={defaultWarehouse}
              onChange={e => applyDefaultWarehouse(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Choisir…</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.city ? `${w.name} — ${w.city}` : w.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Stock insuffisant (R4/H3) */}
      {shortages && shortages.length > 0 && isDraft && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6 text-sm text-red-800">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <div>
              <p className="font-semibold">Stock insuffisant — livraison bloquée</p>
              {error && <p className="mt-0.5">{error}</p>}
            </div>
          </div>
          <ShortageTable shortages={shortages} />
          <p className="mt-3 text-xs text-red-700">
            La livraison est impossible tant que le stock est insuffisant : choisissez un autre dépôt, répartissez la ligne sur plusieurs dépôts,
            réduisez la quantité ou enregistrez d&apos;abord la réception de la marchandise. Aucun stock ne peut devenir négatif.
          </p>
        </div>
      )}

      {isDraft && unlinkedLines.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="unlinked-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>{unlinkedLines.length} ligne{unlinkedLines.length > 1 ? "s" : ""} non rattachée{unlinkedLines.length > 1 ? "s" : ""} au catalogue.</strong> Une ligne sans fiche n&apos;est pas une prestation : rattachez-la à sa fiche (produit ou prestation) pour que le stock soit contrôlé et sorti normalement. La livraison ne peut pas être confirmée avant.</p>
        </div>
      )}
      {linkInfo && <p className="mb-4 text-sm text-emerald-700">{linkInfo}</p>}
      {error && !confirmOpen && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* Lignes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Qté à livrer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-64">Entrepôt de sortie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lines.map(l => isComment(l) ? (
              <tr key={l.id} className="bg-gray-50">
                <td colSpan={3} className="px-4 py-2.5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 text-[11px] px-1.5 py-0.5 rounded font-medium bg-gray-200 text-gray-600">Commentaire</span>
                    <p className="flex-1 text-sm italic text-gray-600 whitespace-pre-line">{l.description}</p>
                    {l.print_on_delivery !== true && (
                      <span className="mt-0.5 shrink-0 text-xs text-gray-400">Non imprimé sur le bon de livraison</span>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={l.id} className={kind(l) === "unlinked" ? "bg-amber-50/60" : kind(l) === "service" ? "opacity-60" : ""} data-kind={kind(l)}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {l.split_of ? <span className="text-xs text-gray-500 font-normal">↳ suite de la ligne (autre dépôt)</span> : l.description}
                  {kind(l) === "product" && !l.split_of && (
                    <div className="mt-0.5 text-xs font-normal text-gray-500" data-testid="product-details">
                      {[l.product_code, l.brand, l.packaging, l.unit ? `unité : ${l.unit}` : null].filter(Boolean).join(" · ") || "—"}
                    </div>
                  )}
                  {kind(l) === "product" && !l.split_of && isDraft && (
                    <div className="mt-0.5 text-xs font-normal text-gray-500" data-testid="stock-per-warehouse">
                      Stock total {fmtQ(totalStock(l.product_id))}
                      {warehouses.map(w => ` · ${w.name} : ${fmtQ(qtyIn(l.product_id, w.id))}`).join("")}
                    </div>
                  )}
                  {kind(l) === "product" && !l.split_of && l.invoice_line_id && remaining[l.invoice_line_id] && (
                    <div className="mt-0.5 text-xs font-normal text-gray-500">
                      Facturé {fmtQ(remaining[l.invoice_line_id].invoiced)} · déjà livré {fmtQ(remaining[l.invoice_line_id].delivered)} · reste {fmtQ(remaining[l.invoice_line_id].remaining)}
                    </div>
                  )}
                  {kind(l) === "service" && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">(prestation — pas de stock)</span>
                  )}
                  {kind(l) === "unlinked" && (
                    <div className="mt-1 font-normal">
                      <span className="text-xs font-semibold text-amber-700">Non rattachée au catalogue</span>
                      {canLink && (
                        <select
                          defaultValue=""
                          disabled={linking === l.id}
                          onChange={e => linkLine(l.id, e.target.value)}
                          className="ml-2 max-w-xs rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          data-testid="link-select"
                        >
                          <option value="">{linking === l.id ? "Rattachement…" : "Rattacher à la fiche…"}</option>
                          {suggestProducts(l.description, products).length > 0 && (
                            <optgroup label="Suggestions (à vérifier)">
                              {suggestProducts(l.description, products).map(p => <option key={`s-${p.id}`} value={p.id}>{p.name}{p.reference ? ` — ${p.reference}` : ""}{p.product_type === "service" ? " (prestation)" : ""}</option>)}
                            </optgroup>
                          )}
                          <optgroup label="Toutes les fiches actives">
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.reference ? ` — ${p.reference}` : ""}{p.product_type === "service" ? " (prestation)" : ""}</option>)}
                          </optgroup>
                        </select>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {canConfirm && kind(l) === "product" ? (
                    <input
                      type="number" min="0" step="any"
                      value={l.quantity}
                      onChange={e => setLineQuantity(l.id, e.target.value)}
                      className="w-20 text-right px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="text-gray-700">{l.quantity.toLocaleString("fr")}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {kind(l) === "product" ? (
                    canConfirm ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={l.warehouse_id ?? ""}
                          onChange={e => setLineWarehouse(l.id, e.target.value)}
                          className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${l.warehouse_id ? "border-gray-200" : "border-red-300 bg-red-50"}`}
                          data-testid="warehouse-select"
                        >
                          <option value="">Choisir…</option>
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.city ? `${w.name} — ${w.city}` : w.name} (stock : {fmtQ(qtyIn(l.product_id, w.id))})</option>
                          ))}
                          {directWarehouse && l.invoice_line_id && (remaining[l.invoice_line_id]?.direct ?? 0) > 0 && (
                            <option value={directWarehouse.id}>Livraison directe (réceptionné pour ce client : {fmtQ(remaining[l.invoice_line_id].direct)})</option>
                          )}
                        </select>
                        {l.split_of ? (
                          <button type="button" onClick={() => removeSplit(l.id)} className="px-1.5 text-gray-400 hover:text-red-500" title="Retirer cette répartition">✕</button>
                        ) : (
                          <button type="button" onClick={() => splitLine(l)} className="whitespace-nowrap px-1.5 text-xs text-blue-600 hover:underline" title="Livrer une partie de cette ligne depuis un autre dépôt" data-testid="split-line">Répartir</button>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-600 text-xs">{warehouseLabel(l.warehouse_id)}</span>
                    )
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dn.notes && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{dn.notes}</p>
        </div>
      )}

      {/* Zone impression */}
      <div className="print-root hidden print:block">
        <BonLivraisonPrint dn={dn} lines={lines} warehouseLabel={warehouseLabel} docSettings={docSettings} locale={locale} />
      </div>

      {/* Modal confirmation livraison */}
      <Modal open={confirmOpen} onClose={() => { setConfirmOpen(false); setError(null) }} title="Confirmer la livraison">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <Truck className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Sortie de stock définitive</p>
              <p>
                {stockLines.length} produit(s) seront retirés du stock.
                Cette action est irréversible.
              </p>
            </div>
          </div>

          {/* Récap par entrepôt */}
          {stockLines.filter(l => l.warehouse_id).length > 0 && (
            <div className="space-y-1 text-sm">
              {stockLines.map(l => (
                <div key={l.id} className="flex justify-between py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-700">{l.description}</span>
                  <span className="text-gray-500 text-xs">{l.quantity} × {warehouseLabel(l.warehouse_id)}</span>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setConfirmOpen(false); setError(null) }}>Annuler</Button>
            <Button onClick={() => confirmDelivery()} disabled={saving}>
              {saving ? "Confirmation…" : "Confirmer la livraison"}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}

interface Shortage { product_id?: string; product: string; warehouse_id?: string; warehouse: string; requested: number; available: number; missing: number; result: number }

// Shortage detail per product and warehouse; the resulting stock is shown even when negative
function ShortageTable({ shortages }: { shortages: Shortage[] }) {
  const fmt = (n: number) => Number(n).toLocaleString("fr")
  return (
    <div className="overflow-x-auto rounded-lg border border-red-200 bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-red-50 text-red-800">
            <th className="text-left px-3 py-2 font-medium">Produit</th>
            <th className="text-left px-3 py-2 font-medium">Dépôt</th>
            <th className="text-right px-3 py-2 font-medium">Qté à livrer</th>
            <th className="text-right px-3 py-2 font-medium">Stock disponible</th>
            <th className="text-right px-3 py-2 font-medium">Manquant</th>
            <th className="text-right px-3 py-2 font-medium">Stock résultant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-red-100">
          {shortages.map((s, i) => (
            <tr key={`${s.product_id ?? s.product}-${s.warehouse_id ?? s.warehouse}-${i}`}>
              <td className="px-3 py-2 font-medium text-gray-900">{s.product}</td>
              <td className="px-3 py-2 text-gray-700">{s.warehouse}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(s.requested)}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${s.available < 0 ? "text-red-600 font-semibold" : ""}`}>{fmt(s.available)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-red-600 font-semibold">{fmt(s.missing)}</td>
              <td className={`px-3 py-2 text-right tabular-nums font-semibold ${s.result < 0 ? "text-red-600" : "text-gray-900"}`}>{fmt(s.result)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Composant d'impression inline (pas de Tailwind pour print)
function BonLivraisonPrint({ dn, lines, warehouseLabel, docSettings, locale }: {
  dn: DN
  lines: DNLine[]
  warehouseLabel: (wid: string | null) => string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docSettings: Record<string, any>
  locale: string
}) {
  const brandColor = docSettings.brand_color || "#2563eb"
  const today = new Date().toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { day: "2-digit", month: "long", year: "numeric" })

  return (
    <div style={{ fontFamily: "Arial, sans-serif", maxWidth: 740, margin: "0 auto", padding: "40px 0", color: "#1a1a1a" }}>
      {/* Bandeau couleur */}
      <div style={{ height: 6, background: brandColor, borderRadius: 3, marginBottom: 32 }} />

      {/* En-tête */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          {docSettings.logo_url
            ? <img src={docSettings.logo_url} alt="Logo" style={{ height: 48, objectFit: "contain", marginBottom: 8 }} />
            : <div style={{ width: 48, height: 48, background: brandColor, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
                {(docSettings.company_name || "GEG").charAt(0)}
              </div>
          }
          <div style={{ fontSize: 13, color: "#374151" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{docSettings.company_name || ""}</div>
            {docSettings.address && <div>{docSettings.address}</div>}
            {docSettings.email && <div>{docSettings.email}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: brandColor, letterSpacing: -0.5 }}>BON DE LIVRAISON</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111", marginTop: 4 }}>{dn.number}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Date : {today}</div>
          {dn.delivery_date && <div style={{ fontSize: 12, color: "#6b7280" }}>Livraison : {formatDateSimple(dn.delivery_date)}</div>}
        </div>
      </div>

      {/* Client */}
      {dn.account_name && (
        <div style={{ marginBottom: 24, padding: "12px 16px", background: "#f9fafb", borderRadius: 8, borderLeft: `3px solid ${brandColor}` }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", color: "#9ca3af", letterSpacing: 1, marginBottom: 4 }}>Destinataire</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{dn.account_name}</div>
        </div>
      )}

      {/* Tableau des lignes */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead>
          <tr style={{ background: brandColor, color: "#fff" }}>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600 }}>Description</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, width: 80 }}>Quantité</th>
          </tr>
        </thead>
        <tbody>
          {/* Comments: printed only when chosen for the delivery note, italic over the full width, no quantity */}
          {lines.filter(l => !isComment(l) || l.print_on_delivery === true).map((l, i) => isComment(l) ? (
            <tr key={l.id}>
              <td colSpan={2} style={{ padding: "8px 12px", fontSize: 12, fontStyle: "italic", color: "#4b5563", borderBottom: "1px solid #f3f4f6", whiteSpace: "pre-line" }}>{l.description}</td>
            </tr>
          ) : (
            <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
              <td style={{ padding: "10px 12px", fontSize: 12, borderBottom: "1px solid #f3f4f6" }}>{l.description}</td>
              <td style={{ padding: "10px 12px", fontSize: 12, textAlign: "right", borderBottom: "1px solid #f3f4f6", fontWeight: 600 }}>
                {l.quantity.toLocaleString("fr")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Zone signature */}
      <div style={{ display: "flex", gap: 32, marginTop: 48 }}>
        <div style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 48 }}>Signature du livreur</div>
          <div style={{ borderTop: "1px solid #d1d5db", paddingTop: 8, fontSize: 11, color: "#9ca3af" }}>Nom & Signature</div>
        </div>
        <div style={{ flex: 1, border: "2px solid " + brandColor, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Lu et approuvé par le client</div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 40 }}>Bon pour réception des marchandises</div>
          <div style={{ borderTop: "1px solid #d1d5db", paddingTop: 8, fontSize: 11, color: "#9ca3af" }}>Nom, Date & Cachet</div>
        </div>
      </div>

      {/* Notes */}
      {dn.notes && (
        <div style={{ marginTop: 24, fontSize: 11, color: "#6b7280" }}>
          <strong>Notes :</strong> {dn.notes}
        </div>
      )}

      {/* Footer */}
      {docSettings.footer_text && (
        <div style={{ marginTop: 40, borderTop: "1px solid #e5e7eb", paddingTop: 16, fontSize: 10, color: "#9ca3af", textAlign: "center" }}>
          {docSettings.footer_text}
        </div>
      )}
    </div>
  )
}

function formatDateSimple(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}
