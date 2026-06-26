"use client"

import { useEffect } from "react"
import { formatDate, formatNumber } from "@/lib/utils"

interface Line {
  id: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  product: { name: string; reference: string | null } | null
}

interface DocSettings {
  company_name?: string | null
  tagline?: string | null
  address_line1?: string | null
  city?: string | null
  phone?: string | null
  nif?: string | null
  logo_url?: string | null
  bank_name?: string | null
  bank_account?: string | null
  bank_iban?: string | null
  footer_text?: string | null
  tva_rate?: number | null
  brand_color?: string | null
}

interface Props {
  number: string
  status: string
  currency: string
  issueDate: string
  dueDate: string | null
  notes: string | null
  accountName: string
  accountCountry: string | null
  lines: Line[]
  locale: string
  docSettings?: DocSettings | null
}

export default function FacturePrintPage({
  number, status, currency, issueDate, dueDate, notes,
  accountName, lines, locale, docSettings,
}: Props) {
  useEffect(() => {
    document.title = `FACTURE - ${number}`
  }, [number])

  const tvaRate = docSettings?.tva_rate ?? 18
  const color = docSettings?.brand_color ?? "#1e3a5f"

  const totalHT = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100), 0)
  const tvaAmt = totalHT * tvaRate / 100
  const totalTTC = totalHT + tvaAmt

  const companyName = docSettings?.company_name ?? "GEG Guinée"
  const tagline = docSettings?.tagline ?? "Beyond Limits."
  const addr1 = docSettings?.address_line1 ?? ""
  const city = docSettings?.city ?? "Conakry"
  const phone = docSettings?.phone ?? ""
  const nif = docSettings?.nif ?? ""
  const logoUrl = docSettings?.logo_url ?? "/geg-logo.png"
  const bankName = docSettings?.bank_name ?? ""
  const bankAccount = docSettings?.bank_account ?? ""
  const bankIban = docSettings?.bank_iban ?? ""

  const statusLabels: Record<string, string> = {
    draft: "Brouillon", sent: "Émise", partial: "Part. réglée", paid: "Payée", cancelled: "Annulée",
  }

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #111; background: #e8e8e8; }
        .no-print { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; z-index: 999; }
        .btn { padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
        .btn-primary { background: ${color}; color: white; }
        .btn-secondary { background: #e0e0e0; color: #333; }
        .page { max-width: 210mm; margin: 20px auto; padding: 14mm 16mm 16mm; min-height: 297mm; background: white; box-shadow: 0 4px 24px rgba(0,0,0,0.15); display: flex; flex-direction: column; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .header-left .tagline { font-size: 18px; font-weight: 900; color: ${color}; letter-spacing: -0.5px; margin-bottom: 14px; }
        .header-right { text-align: right; }
        .header-right .logo-img { height: 48px; object-fit: contain; margin-bottom: 6px; display: block; margin-left: auto; }
        .header-right .logo-fallback { font-size: 22px; font-weight: 900; color: ${color}; margin-bottom: 4px; }
        .header-right .co-name { font-size: 11px; font-weight: 700; color: #111; }
        .header-right .co-detail { font-size: 10px; color: #555; line-height: 1.5; }
        .client-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; }
        .client-name { font-size: 13px; font-weight: 700; color: #111; }
        .doc-number { font-size: 26px; font-weight: 900; color: #111; letter-spacing: -0.5px; }
        .meta-bar { border: 1px solid #ddd; border-radius: 6px; display: flex; margin-bottom: 20px; overflow: hidden; }
        .meta-cell { flex: 1; padding: 8px 14px; border-right: 1px solid #ddd; }
        .meta-cell:last-child { border-right: none; }
        .meta-cell label { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: ${color}; margin-bottom: 3px; }
        .meta-cell span { font-size: 11px; font-weight: 600; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10.5px; }
        thead tr { background: #f5f5f5; }
        thead th { padding: 8px 10px; text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #333; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; }
        .th-right { text-align: right; }
        tbody tr { border-bottom: 1px solid #eeeeee; }
        tbody td { padding: 8px 10px; vertical-align: middle; }
        .td-right { text-align: right; }
        .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 16px; }
        .totals-table { width: 300px; font-size: 11px; border-collapse: collapse; }
        .totals-table td { padding: 5px 10px; }
        .totals-table .tr-ht td { color: #555; }
        .totals-table .tr-tva td { color: #555; }
        .totals-table .tr-total { background: #f0f0f0; }
        .totals-table .tr-total td { font-weight: 800; font-size: 12px; border-top: 1px solid #ccc; }
        .totals-table .td-label { text-align: left; }
        .totals-table .td-val { text-align: right; white-space: nowrap; }
        .notes-box { background: #fafafa; border-left: 3px solid ${color}; padding: 8px 12px; font-size: 10px; color: #555; line-height: 1.5; margin-bottom: 12px; }
        .bank-section { margin-top: auto; border-top: 1px solid #ccc; padding-top: 12px; font-size: 10px; }
        .bank-section .bank-title { font-weight: 700; font-size: 11px; margin-bottom: 4px; }
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .page { margin: 0; box-shadow: none; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      <div className="no-print">
        <button className="btn btn-secondary" onClick={() => window.close()}>✕ Fermer</button>
        <button className="btn btn-primary" onClick={() => window.print()}>⬇ Télécharger PDF</button>
      </div>

      <div className="page">
        <div className="header">
          <div className="header-left">
            <div className="tagline">{tagline}</div>
          </div>
          <div className="header-right">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="logo-img" />
              : <div className="logo-fallback">{companyName.split(" ").map((w: string) => w[0]).join("").slice(0, 3)}</div>
            }
            <div className="co-name">{companyName}</div>
            <div className="co-detail">
              {addr1 && <>{addr1}<br /></>}
              {city}<br />
              {phone && <>Tél. : {phone}<br /></>}
              {nif && <>NIF : {nif}</>}
            </div>
          </div>
        </div>

        <div className="client-row">
          <div className="client-name">{accountName}</div>
          <div className="doc-number">Facture # {number}</div>
        </div>

        <div className="meta-bar">
          <div className="meta-cell">
            <label>Date de facture</label>
            <span>{formatDate(issueDate, locale)}</span>
          </div>
          {dueDate && (
            <div className="meta-cell">
              <label>Échéance</label>
              <span>{formatDate(dueDate, locale)}</span>
            </div>
          )}
          <div className="meta-cell">
            <label>Statut</label>
            <span>{statusLabels[status] ?? status}</span>
          </div>
          <div className="meta-cell">
            <label>Devise</label>
            <span>{currency}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: "42%" }}>Description</th>
              <th className="th-right" style={{ width: "12%" }}>Quantité</th>
              <th className="th-right" style={{ width: "20%" }}>Prix unitaire</th>
              <th className="th-right" style={{ width: "12%" }}>TVA</th>
              <th className="th-right" style={{ width: "14%" }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => {
              const sub = l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100)
              return (
                <tr key={l.id}>
                  <td>{l.description}</td>
                  <td className="td-right">{formatNumber(l.quantity, 2)} Unité</td>
                  <td className="td-right">{formatNumber(l.unit_price, 2)} {currency}</td>
                  <td className="td-right">{tvaRate > 0 ? `TVA ${tvaRate}% (vente)` : "—"}</td>
                  <td className="td-right" style={{ fontWeight: 600 }}>{formatNumber(sub, 2)} {currency}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="totals-wrap">
          <table className="totals-table">
            <tbody>
              <tr className="tr-ht">
                <td className="td-label">Montant hors taxes</td>
                <td className="td-val">{formatNumber(totalHT, 2)} {currency}</td>
              </tr>
              {tvaAmt > 0 && (
                <tr className="tr-tva">
                  <td className="td-label">TVA {tvaRate}% sur {formatNumber(totalHT, 2)} {currency}</td>
                  <td className="td-val">{formatNumber(tvaAmt, 2)} {currency}</td>
                </tr>
              )}
              <tr className="tr-total">
                <td className="td-label">Total</td>
                <td className="td-val">{formatNumber(totalTTC, 2)} {currency}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {notes && <div className="notes-box">{notes}</div>}

        {(bankName || bankAccount) && (
          <div className="bank-section">
            <div className="bank-title">Paiement à :</div>
            <div>{companyName}</div>
            {bankName && <div>Nom de la Banque: {bankName}</div>}
            {bankAccount && <div>N° de Compte : {bankAccount}</div>}
            {bankIban && <div>IBAN : {bankIban}</div>}
          </div>
        )}
      </div>
    </>
  )
}
