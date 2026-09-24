"use client"

import { useEffect } from "react"
import { formatDate } from "@/lib/utils"

function fmt(value: number, decimals = 0): string {
  const parts = value.toFixed(decimals).split(".")
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return decimals > 0 ? parts.join(",") : parts[0]
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

export default function AchatPrintPage({
  number, status, currency, orderDate, expectedDate, supplierName, incoterm, notes, lines, totalHT, locale, docSettings,
}: Props) {

  useEffect(() => {
    document.title = `Bon de commande ${number}`
    setTimeout(() => window.print(), 600)
  }, [number])

  const color = docSettings?.brand_color ?? "#1e3a5f"
  const colorLight = color + "14"
  const companyName = docSettings?.company_name ?? "Global Energy Group SAS"
  const tagline = docSettings?.tagline ?? "Beyond Limits."
  const addr1 = docSettings?.address_line1 ?? "Imm. Marbella"
  const city = docSettings?.city ?? "Lambanyii - Conakry"
  const phone = docSettings?.phone ?? "+224 613 04 40 20"
  const website = docSettings?.website ?? "www.globalenergygroup.com"
  const nif = docSettings?.nif ?? null
  const rccm = docSettings?.rccm ?? null

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { font-family: 'Inter', sans-serif; background: white; color: #1a1a2e; font-size: 13px; }
          .page { width: 210mm; min-height: 297mm; padding: 0; margin: 0 auto; display: flex; flex-direction: column; }
          .header { background: ${color}; color: white; padding: 28px 36px 24px; display: flex; align-items: flex-start; justify-content: space-between; }
          .company-name { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
          .tagline { font-size: 10px; opacity: 0.6; margin-top: 2px; letter-spacing: 1px; text-transform: uppercase; }
          .company-address { font-size: 10px; opacity: 0.75; margin-top: 6px; line-height: 1.5; }
          .doc-type { text-align: right; }
          .doc-type-label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px; }
          .doc-number { font-size: 20px; font-weight: 700; margin-top: 4px; }
          .status-badge { display: inline-block; font-size: 9px; font-weight: 600; padding: 2px 8px; border-radius: 99px; background: rgba(255,255,255,0.2); margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
          .body { flex: 1; padding: 28px 36px; }
          .meta-row { display: flex; gap: 32px; margin-bottom: 28px; }
          .meta-block { flex: 1; }
          .meta-label { font-size: 9px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
          .meta-value { font-size: 13px; font-weight: 600; color: #1a1a2e; }
          .meta-sub { font-size: 11px; color: #555; margin-top: 2px; }
          .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${color}; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid ${color}; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          thead tr { background: ${color}; color: white; }
          thead th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
          thead th.right { text-align: right; }
          tbody tr { border-bottom: 1px solid #f0f0f0; }
          tbody tr:nth-child(even) { background: ${colorLight}; }
          tbody td { padding: 8px 10px; font-size: 12px; color: #2d2d2d; }
          tbody td.right { text-align: right; font-variant-numeric: tabular-nums; }
          tbody td.mono { font-family: 'Courier New', monospace; font-size: 11px; }
          .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
          .totals-box { width: 240px; }
          .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; border-bottom: 1px solid #f0f0f0; }
          .total-row.grand { border-top: 2px solid ${color}; border-bottom: none; padding-top: 8px; margin-top: 4px; font-size: 14px; font-weight: 700; color: ${color}; }
          .notes-box { background: ${colorLight}; border-left: 3px solid ${color}; padding: 10px 14px; border-radius: 4px; font-size: 11px; color: #444; line-height: 1.6; margin-bottom: 24px; white-space: pre-wrap; }
          .footer-bar { background: ${color}; color: white; padding: 10px 36px; display: flex; align-items: center; gap: 16px; margin-top: auto; }
          .footer-item { display: flex; flex-direction: column; gap: 1px; }
          .footer-item span { font-size: 7.5px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.5px; }
          .footer-item strong { font-size: 10px; font-weight: 600; }
          .footer-divider { width: 1px; height: 18px; background: rgba(255,255,255,.25); }
          @media print {
            html, body { margin: 0; }
            .page { width: 100%; min-height: 100vh; }
            @page { margin: 0; size: A4; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">
          {/* Header */}
          <div className="header">
            <div>
              <div className="company-name">{companyName}</div>
              <div className="tagline">{tagline}</div>
              <div className="company-address">
                {addr1}<br />{city}
                {rccm && <><br />RCCM : {rccm}</>}
              </div>
            </div>
            <div className="doc-type">
              <div className="doc-type-label">Bon de commande</div>
              <div className="doc-number">{number}</div>
              <div className="status-badge">{status}</div>
            </div>
          </div>

          {/* Body */}
          <div className="body">
            {/* Meta */}
            <div className="meta-row">
              <div className="meta-block">
                <div className="meta-label">Fournisseur</div>
                <div className="meta-value">{supplierName}</div>
                {incoterm && <div className="meta-sub">Incoterm : {incoterm}</div>}
              </div>
              <div className="meta-block">
                <div className="meta-label">Date de commande</div>
                <div className="meta-value">{formatDate(orderDate, locale)}</div>
              </div>
              {expectedDate && (
                <div className="meta-block">
                  <div className="meta-label">Arrivée prévue</div>
                  <div className="meta-value">{formatDate(expectedDate, locale)}</div>
                </div>
              )}
              <div className="meta-block">
                <div className="meta-label">Devise</div>
                <div className="meta-value">{currency}</div>
              </div>
            </div>

            {/* Lines */}
            <div className="section-title">Produits commandés</div>
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
                    <td className="right mono">{fmt(l.quantity)}</td>
                    <td className="right mono">{fmt(l.unit_price)}</td>
                    <td className="right mono">{fmt(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="totals">
              <div className="totals-box">
                <div className="total-row grand">
                  <span>Total HT</span>
                  <span>{fmt(totalHT)} {currency}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {notes && (
              <>
                <div className="section-title">Notes / Conditions</div>
                <div className="notes-box">{notes}</div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="footer-bar">
            {phone && (
              <div className="footer-item">
                <span>Tél</span>
                <strong>{phone}</strong>
              </div>
            )}
            {phone && website && <div className="footer-divider" />}
            {website && (
              <div className="footer-item">
                <span>Web</span>
                <strong>{website}</strong>
              </div>
            )}
            {nif && <div className="footer-divider" />}
            {nif && (
              <div className="footer-item">
                <span>NIF / UEN</span>
                <strong>{nif}</strong>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
