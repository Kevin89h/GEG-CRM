"use client"

import { useEffect } from "react"
import { formatDate } from "@/lib/utils"

function fmt(value: number): string {
  return value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

interface Line {
  description: string
  quantity: number
  unit_price: number
  total: number
}

interface DocSettings {
  company_name?: string | null
  tagline?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  nif?: string | null
  rccm?: string | null
  logo_url?: string | null
  brand_color?: string | null
}

interface Props {
  number: string
  status: string
  currency: string
  orderDate: string
  expectedDate: string | null
  supplierName: string
  incoterm: string | null
  notes: string | null
  lines: Line[]
  totalHT: number
  locale: string
  docSettings?: DocSettings | null
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyé", confirmed: "Confirmé",
  in_transit: "En transit", received: "Reçu", cancelled: "Annulé",
}

export default function AchatPrintPage({
  number, status, currency, orderDate, expectedDate,
  supplierName, incoterm, notes, lines, totalHT, locale, docSettings,
}: Props) {

  useEffect(() => {
    document.title = `Bon de commande ${number}`
  }, [number])

  const color = docSettings?.brand_color ?? "#1e3a5f"
  const companyName = docSettings?.company_name ?? "Global Energy Group SAS"
  const tagline = docSettings?.tagline ?? "Beyond Limits."
  const addr1 = docSettings?.address_line1 ?? "Imm. Marbella"
  const city = docSettings?.city ?? "Lambanyii - Conakry"
  const phone = docSettings?.phone ?? "+224 613 04 40 20"
  const website = docSettings?.website ?? "www.globalenergygroup.com"
  const nif = docSettings?.nif ?? null
  const rccm = docSettings?.rccm ?? null
  const logoUrl = docSettings?.logo_url ?? null

  const initials = companyName.split(" ").map((w: string) => w[0]).join("").slice(0, 3)

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-size: 11px;
          color: #111;
          background: #d0d0d0;
        }
        .no-print {
          position: fixed; top: 16px; right: 16px;
          display: flex; gap: 8px; z-index: 999;
        }
        .btn {
          padding: 10px 22px; border-radius: 8px; font-size: 13px;
          font-weight: 600; cursor: pointer; border: none; transition: opacity .15s;
        }
        .btn:hover { opacity: .85; }
        .btn-primary { background: ${color}; color: white; }
        .btn-secondary { background: #e5e5e5; color: #333; }
        .page {
          width: 210mm;
          min-height: 297mm;
          margin: 24px auto;
          background: white;
          box-shadow: 0 8px 40px rgba(0,0,0,.22);
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }
        .stripe { height: 5px; background: linear-gradient(90deg, ${color} 0%, ${color}88 100%); flex-shrink: 0; }
        .page-body { flex: 1; display: flex; flex-direction: column; }
        .header {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 22px 24px 18px; border-bottom: 1px solid #eee;
        }
        .logo { height: 52px; object-fit: contain; display: block; margin-bottom: 8px; }
        .logo-initials { font-size: 28px; font-weight: 900; color: ${color}; letter-spacing: -1px; margin-bottom: 4px; }
        .co-name { font-size: 12px; font-weight: 800; color: #111; }
        .co-tagline { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
        .co-addr { font-size: 9.5px; color: #666; line-height: 1.7; margin-top: 6px; }
        .doc-info { text-align: right; flex-shrink: 0; }
        .doc-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #bbb; margin-bottom: 4px; }
        .doc-number { font-size: 28px; font-weight: 900; color: #111; letter-spacing: -1px; line-height: 1; }
        .status-badge {
          display: inline-block; margin-top: 7px;
          padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700;
          background: ${color}18; color: ${color};
        }
        .meta-bar {
          display: flex; margin: 18px 24px; border-radius: 8px; overflow: hidden;
          border: 1px solid #eee; background: #fafafa;
        }
        .meta-cell { flex: 1; padding: 10px 14px; border-right: 1px solid #eee; }
        .meta-cell:last-child { border-right: none; }
        .meta-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 3px; }
        .meta-value { font-size: 12px; font-weight: 700; color: #111; }
        .supplier-row {
          margin: 0 24px 18px; padding: 14px; border-radius: 8px;
          background: ${color}08; border: 1px solid ${color}22;
        }
        .supplier-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${color}; margin-bottom: 4px; }
        .supplier-name { font-size: 16px; font-weight: 900; color: #111; }
        .supplier-sub { font-size: 10px; color: #666; margin-top: 3px; }
        .section-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${color}; margin: 0 24px 8px; padding-bottom: 4px; border-bottom: 2px solid ${color}; }
        table { width: calc(100% - 48px); margin: 0 24px 18px; border-collapse: collapse; }
        thead tr { background: ${color}; color: white; }
        thead th { padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        thead th.right { text-align: right; }
        tbody tr { border-bottom: 1px solid #f0f0f0; }
        tbody tr:nth-child(even) { background: ${color}06; }
        tbody td { padding: 8px 10px; font-size: 11px; color: #2d2d2d; }
        tbody td.right { text-align: right; font-variant-numeric: tabular-nums; }
        .totals-block { display: flex; justify-content: flex-end; margin: 0 24px 20px; }
        .totals-inner { width: 220px; }
        .tot-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 11px; border-bottom: 1px solid #f0f0f0; }
        .tot-grand { border-top: 2px solid ${color} !important; border-bottom: none; padding-top: 8px; margin-top: 4px; font-size: 13.5px; font-weight: 800; color: #111; }
        .notes-block { margin: 0 24px 20px; }
        .notes-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${color}; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid ${color}; }
        .notes-text { font-size: 10.5px; color: #444; line-height: 1.7; white-space: pre-wrap; padding: 10px 14px; background: ${color}06; border-left: 3px solid ${color}; border-radius: 4px; }
        .footer-bar {
          background: ${color};
          padding: 11px 24px;
          display: flex; justify-content: center; align-items: center;
          gap: 0; flex-shrink: 0; flex-wrap: wrap; margin-top: auto;
        }
        .footer-item {
          display: flex; align-items: center; gap: 5px;
          color: rgba(255,255,255,.9); font-size: 9.5px;
          padding: 0 14px;
        }
        .footer-item strong { color: white; }
        .footer-divider { width: 1px; height: 18px; background: rgba(255,255,255,.25); }
        @media print {
          html, body { background: white; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 0; }
          .page { margin: 0 !important; box-shadow: none !important; width: 210mm; }
          .footer-bar { break-before: avoid; page-break-before: avoid; break-inside: avoid; }
        }
      `}</style>

      <div className="no-print">
        <button className="btn btn-secondary" onClick={() => window.close()}>✕ Fermer</button>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Imprimer / PDF</button>
      </div>

      <div className="page">
        <div className="stripe" />
        <div className="page-body">

          {/* Header */}
          <div className="header">
            <div>
              {logoUrl
                ? <img src={logoUrl} alt={companyName} className="logo" />
                : <div className="logo-initials">{initials}</div>}
              <div className="co-name">{companyName}</div>
              <div className="co-tagline">{tagline}</div>
              <div className="co-addr">
                {addr1}<br />{city}
                {rccm && <><br />RCCM : {rccm}</>}
              </div>
            </div>
            <div className="doc-info">
              <div className="doc-label">Bon de commande</div>
              <div className="doc-number">{number}</div>
              <div className="status-badge">{STATUS_LABELS[status] ?? status}</div>
            </div>
          </div>

          {/* Supplier */}
          <div className="supplier-row" style={{ marginTop: 18 }}>
            <div className="supplier-label">Fournisseur</div>
            <div className="supplier-name">{supplierName}</div>
            {incoterm && <div className="supplier-sub">Incoterm : {incoterm}</div>}
          </div>

          {/* Meta */}
          <div className="meta-bar">
            <div className="meta-cell">
              <div className="meta-label">Date de commande</div>
              <div className="meta-value">{formatDate(orderDate, locale)}</div>
            </div>
            {expectedDate && (
              <div className="meta-cell">
                <div className="meta-label">Arrivée prévue</div>
                <div className="meta-value">{formatDate(expectedDate, locale)}</div>
              </div>
            )}
            <div className="meta-cell">
              <div className="meta-label">Devise</div>
              <div className="meta-value">{currency}</div>
            </div>
          </div>

          {/* Lines */}
          <div className="section-label">Produits commandés</div>
          <table>
            <thead>
              <tr>
                <th style={{ width: "50%" }}>Description</th>
                <th className="right" style={{ width: "12%" }}>Qté</th>
                <th className="right" style={{ width: "19%" }}>Prix unitaire</th>
                <th className="right" style={{ width: "19%" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.description}</td>
                  <td className="right">{fmt(l.quantity)}</td>
                  <td className="right">{fmt(l.unit_price)}</td>
                  <td className="right">{fmt(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="totals-block">
            <div className="totals-inner">
              <div className="tot-row tot-grand">
                <span>Total HT</span>
                <span>{fmt(totalHT)} {currency}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div className="notes-block">
              <div className="notes-label">Notes / Conditions</div>
              <div className="notes-text">{notes}</div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="footer-bar">
          {phone && (
            <div className="footer-item">
              <span>📞</span><strong>{phone}</strong>
            </div>
          )}
          {phone && website && <div className="footer-divider" />}
          {website && (
            <div className="footer-item">
              <span>🌐</span><strong>{website}</strong>
            </div>
          )}
          {nif && <div className="footer-divider" />}
          {nif && (
            <div className="footer-item">
              <span>NIF/UEN</span><strong>{nif}</strong>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
