"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Printer, CheckCircle, Truck, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Select"
import { Modal } from "@/components/ui/Modal"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatDate } from "@/lib/utils"

interface DNLine {
  id: string
  product_id: string | null
  description: string
  quantity: number
  warehouse_id: string | null
  position: number
}

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

interface Warehouse { id: string; name: string; city: string | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { dn: DN; lines: DNLine[]; warehouses: Warehouse[]; locale: string; docSettings?: Record<string, any> }

const statusConfig: Record<string, { label: string; color: string }> = {
  draft:     { label: "En cours", color: "bg-amber-100 text-amber-700" },
  delivered: { label: "Livré",    color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Annulé",   color: "bg-red-100 text-red-600" },
}

export default function BonLivraisonClient({ dn, lines: initialLines, warehouses, locale, docSettings = {} }: Props) {
  const router = useRouter()
  const [lines, setLines] = useState(initialLines)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Entrepôt par défaut = premier dispo, ou peut être surchargé par ligne
  const [defaultWarehouse, setDefaultWarehouse] = useState(warehouses[0]?.id ?? "")

  const isDraft = dn.status === "draft"

  function setLineWarehouse(lineId: string, warehouseId: string) {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, warehouse_id: warehouseId } : l))
  }

  function setLineQuantity(lineId: string, value: string) {
    const qty = parseFloat(value) || 0
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, quantity: qty } : l))
  }

  // Appliquer l'entrepôt par défaut à toutes les lignes sans entrepôt
  function applyDefaultWarehouse(wid: string) {
    setDefaultWarehouse(wid)
    setLines(prev => prev.map(l => ({ ...l, warehouse_id: l.warehouse_id || wid })))
  }

  async function confirmDelivery() {
    const stockLines = lines.filter(l => l.product_id)
    if (stockLines.some(l => !l.warehouse_id)) {
      setError("Assigne un entrepôt à chaque produit avant de confirmer.")
      return
    }

    setSaving(true)
    setError(null)
    const { supabase, db } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // Sauvegarder les quantites ajustees sur le BL
    for (const l of lines) {
      await db.from("delivery_note_lines").update({ quantity: l.quantity, warehouse_id: l.warehouse_id }).eq("id", l.id)
    }

    // Creer les mouvements de stock sortie et mettre a jour stock_levels
    if (stockLines.length > 0) {
      await db.from("stock_moves").insert(
        stockLines.map(l => ({
          type: "out",
          product_id: l.product_id,
          from_warehouse_id: l.warehouse_id,
          quantity: l.quantity,
          reference: dn.number,
          notes: `Livraison ${dn.number}`,
          user_id: user.id,
        }))
      )
      // Mettre a jour stock_levels
      for (const l of stockLines) {
        const { data: level } = await db.from("stock_levels")
          .select("quantity")
          .eq("product_id", l.product_id!)
          .eq("warehouse_id", l.warehouse_id!)
          .maybeSingle()
        const current = Number(level?.quantity ?? 0)
        await db.from("stock_levels")
          .upsert(
            { product_id: l.product_id!, warehouse_id: l.warehouse_id!, quantity: Math.max(0, current - l.quantity) },
            { onConflict: "product_id,warehouse_id" }
          )
      }
    }

    // Marquer le BL comme livré
    await db.from("delivery_notes").update({
      status: "delivered",
      delivery_date: new Date().toISOString().split("T")[0],
    }).eq("id", dn.id)

    setConfirmOpen(false)
    setSaving(false)
    router.refresh()
  }

  async function cancel() {
    if (!window.confirm("Annuler ce bon de livraison ?")) return
    const { supabase, db } = getCompanyClientBrowser()
    await db.from("delivery_notes").update({ status: "cancelled" }).eq("id", dn.id)
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
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" /> Imprimer
          </button>
          {isDraft && (
            <>
              <Button variant="secondary" onClick={cancel} className="text-red-500 border-red-200 hover:bg-red-50">
                <X className="w-4 h-4" /> Annuler
              </Button>
              <Button onClick={() => setConfirmOpen(true)}>
                <Truck className="w-4 h-4" /> Confirmer la livraison
              </Button>
            </>
          )}
          {dn.status === "delivered" && (
            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm px-3 py-2 bg-emerald-50 rounded-lg">
              <CheckCircle className="w-4 h-4" /> Livraison confirmée — stock sorti
            </div>
          )}
        </div>
      </div>

      {/* Entrepôt par défaut (draft seulement) */}
      {isDraft && warehouses.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-6 flex items-center gap-4">
          <Truck className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700 flex-1">Entrepôt de sortie par défaut :</p>
          <div className="w-64">
            <select
              value={defaultWarehouse}
              onChange={e => applyDefaultWarehouse(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.city ? `${w.name} — ${w.city}` : w.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

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
            {lines.map(l => (
              <tr key={l.id} className={!l.product_id ? "opacity-60" : ""}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {l.description}
                  {!l.product_id && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">(prestation — pas de stock)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {isDraft && l.product_id ? (
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
                  {l.product_id ? (
                    isDraft ? (
                      <select
                        value={l.warehouse_id ?? ""}
                        onChange={e => setLineWarehouse(l.id, e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Choisir…</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.city ? `${w.name} — ${w.city}` : w.name}</option>
                        ))}
                      </select>
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
                {lines.filter(l => l.product_id).length} produit(s) seront retirés du stock.
                Cette action est irréversible.
              </p>
            </div>
          </div>

          {/* Récap par entrepôt */}
          {lines.filter(l => l.product_id && l.warehouse_id).length > 0 && (
            <div className="space-y-1 text-sm">
              {lines.filter(l => l.product_id).map(l => (
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
            <Button onClick={confirmDelivery} disabled={saving}>
              {saving ? "Confirmation…" : "Confirmer la livraison"}
            </Button>
          </div>
        </div>
      </Modal>
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
          {lines.map((l, i) => (
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
