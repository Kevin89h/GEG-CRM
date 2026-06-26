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
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Émise", partial: "Partiellement réglée", paid: "Payée", cancelled: "Annulée",
}

export default function FacturePrintPage({
  number, status, currency, issueDate, dueDate, notes,
  accountName, accountCountry, lines, locale,
}: Props) {
  useEffect(() => {
    document.title = `FACTURE - ${number}`
  }, [number])

  const totalHT = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - l.discount / 100), 0)

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #111; background: #f0f0f0; }
        .no-print { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; z-index: 999; }
        .btn { padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
        .btn-primary { background: #1e3a5f; color: white; }
        .btn-secondary { background: #e0e0e0; color: #333; }
        .page { max-width: 210mm; margin: 20px auto; padding: 16mm 16mm 20mm; min-height: 297mm; background: white; box-shadow: 0 4px 24px rgba(0,0,0,0.12); }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
        .logo h1 { font-size: 22px; font-weight: 900; color: #1e3a5f; }
        .logo p { font-size: 10px; color: #888; margin-top: 3px; }
        .doc-type { text-align: right; }
        .doc-type h2 { font-size: 17px; font-weight: 800; color: #1e3a5f; letter-spacing: 1px; }
        .doc-type .num { font-size: 13px; font-weight: 700; color: #333; margin-top: 4px; }
        .doc-type .status-badge { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; background: #e8f0fe; color: #1e3a5f; }
        .divider { border: none; border-top: 2px solid #1e3a5f; margin: 18px 0; }
        .parties { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 40px; }
        .party-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 6px; }
        .party h3 { font-size: 13px; font-weight: 700; }
        .party p { font-size: 11px; color: #666; margin-top: 2px; }
        .meta { background: #f8f9fa; border-radius: 6px; padding: 10px 16px; margin-bottom: 24px; display: flex; gap: 32px; }
        .meta-item label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #aaa; display: block; margin-bottom: 3px; }
        .meta-item span { font-size: 12px; font-weight: 600; }
        .overdue { color: #dc2626; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 11px; }
        thead tr { background: #1e3a5f; color: white; }
        thead th { padding: 9px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .right { text-align: right; }
        tbody tr { border-bottom: 1px solid #f0f0f0; }
        tbody tr:nth-child(even) { background: #fafafa; }
        tbody td { padding: 9px 10px; vertical-align: top; }
        .name { font-weight: 600; }
        .ref { font-size: 9px; color: #aaa; font-family: monospace; }
        .totals { display: flex; justify-content: flex-end; margin-bottom: 20px; }
        .totals-box { width: 280px; border-top: 1px solid #e0e0e0; padding-top: 12px; }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #555; }
        .total-grand { display: flex; justify-content: space-between; padding: 10px 0 0; margin-top: 8px; border-top: 2px solid #1e3a5f; font-size: 15px; font-weight: 800; color: #1e3a5f; }
        .payment-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; font-size: 11px; }
        .payment-box strong { display: block; font-size: 12px; font-weight: 700; color: #15803d; margin-bottom: 4px; }
        .notes-box { background: #fafafa; border-left: 3px solid #1e3a5f; padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 11px; color: #555; line-height: 1.5; margin-bottom: 24px; }
        .footer { border-top: 1px solid #e0e0e0; padding-top: 8px; display: flex; justify-content: space-between; margin-top: 40px; }
        .footer span { font-size: 9px; color: #bbb; }
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
          <div className="logo">
            <h1>GEG Guinée</h1>
            <p>Global Energy Group · Conakry, Guinée</p>
          </div>
          <div className="doc-type">
            <h2>FACTURE</h2>
            <div className="num">N° {number}</div>
            <div className="status-badge">{STATUS_LABELS[status] ?? status}</div>
          </div>
        </div>

        <hr className="divider" />

        <div className="parties">
          <div className="party">
            <div className="party-label">Émetteur</div>
            <h3>GEG Guinée</h3>
            <p>Conakry, Guinée</p>
          </div>
          <div className="party" style={{ textAlign: "right" }}>
            <div className="party-label">Facturé à</div>
            <h3>{accountName}</h3>
            {accountCountry && <p>{accountCountry}</p>}
          </div>
        </div>

        <div className="meta">
          <div className="meta-item">
            <label>Date d&apos;émission</label>
            <span>{formatDate(issueDate, locale)}</span>
          </div>
          {dueDate && (
            <div className="meta-item">
              <label>Échéance</label>
              <span className={dueDate < new Date().toISOString().split("T")[0] && status !== "paid" ? "overdue" : ""}>
                {formatDate(dueDate, locale)}
                {dueDate < new Date().toISOString().split("T")[0] && status !== "paid" && " ⚠ En retard"}
              </span>
            </div>
          )}
          <div className="meta-item">
            <label>Devise</label>
            <span>{currency}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: "45%" }}>Désignation</th>
              <th className="right" style={{ width: "10%" }}>Qté</th>
              <th className="right" style={{ width: "20%" }}>Prix unitaire</th>
              <th className="right" style={{ width: "10%" }}>Rem.</th>
              <th className="right" style={{ width: "15%" }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => {
              const sub = l.quantity * l.unit_price * (1 - l.discount / 100)
              return (
                <tr key={l.id}>
                  <td>
                    <div className="name">{l.description}</div>
                    {l.product?.reference && <div className="ref">{l.product.reference}</div>}
                  </td>
                  <td className="right">{formatNumber(l.quantity)}</td>
                  <td className="right">{formatNumber(l.unit_price)} {currency}</td>
                  <td className="right">{l.discount > 0 ? `${l.discount}%` : "—"}</td>
                  <td className="right" style={{ fontWeight: 600 }}>{formatNumber(sub)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="totals">
          <div className="totals-box">
            <div className="total-row">
              <span>Sous-total HT</span>
              <span style={{ fontWeight: 600, color: "#111" }}>{formatNumber(totalHT)} {currency}</span>
            </div>
            <div className="total-grand">
              <span>TOTAL À PAYER</span>
              <span>{formatNumber(totalHT)} {currency}</span>
            </div>
          </div>
        </div>

        <div className="payment-box">
          <strong>Informations de paiement</strong>
          <p>Virement bancaire · GEG Guinée · Conakry, Guinée</p>
          <p style={{ marginTop: "4px", color: "#555" }}>Référence à indiquer : <strong style={{ fontFamily: "monospace" }}>{number}</strong></p>
        </div>

        {notes && <div className="notes-box">{notes}</div>}

        <div className="footer">
          <span>GEG Guinée · Conakry, Guinée</span>
          <span>{number}</span>
          <span>Généré le {new Date().toLocaleDateString("fr")}</span>
        </div>
      </div>
    </>
  )
}
