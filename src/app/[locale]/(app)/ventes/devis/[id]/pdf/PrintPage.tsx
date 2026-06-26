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
  createdAt: string
  validUntil: string | null
  notes: string | null
  accountName: string
  accountCountry: string | null
  salespersonName: string | null
  lines: Line[]
  locale: string
  docType: "devis" | "bon-livraison"
}

export default function PrintPage({
  number, status, currency, createdAt, validUntil, notes,
  accountName, accountCountry, salespersonName, lines, locale, docType,
}: Props) {
  useEffect(() => {
    document.title = `${docType === "bon-livraison" ? "BL" : status === "confirmed" ? "BC" : "DEVIS"} - ${number}`
  }, [number, status, docType])

  const totalHT = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - l.discount / 100), 0)
  const docLabel = docType === "bon-livraison" ? "BON DE LIVRAISON" : status === "confirmed" ? "BON DE COMMANDE" : "DEVIS"

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
        .doc-type .date { font-size: 10px; color: #999; margin-top: 3px; }
        .divider { border: none; border-top: 2px solid #1e3a5f; margin: 18px 0; }
        .parties { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 40px; }
        .party-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 6px; }
        .party h3 { font-size: 13px; font-weight: 700; }
        .party p { font-size: 11px; color: #666; margin-top: 2px; }
        .meta { background: #f8f9fa; border-radius: 6px; padding: 10px 16px; margin-bottom: 24px; display: flex; gap: 32px; }
        .meta-item label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #aaa; display: block; margin-bottom: 3px; }
        .meta-item span { font-size: 12px; font-weight: 600; }
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
        .totals-box { width: 260px; border-top: 1px solid #e0e0e0; padding-top: 12px; }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #555; }
        .total-grand { display: flex; justify-content: space-between; padding: 10px 0 0; margin-top: 8px; border-top: 2px solid #1e3a5f; font-size: 15px; font-weight: 800; color: #1e3a5f; }
        .notes-box { background: #fafafa; border-left: 3px solid #1e3a5f; padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 11px; color: #555; line-height: 1.5; margin-bottom: 24px; }
        .footer { border-top: 1px solid #e0e0e0; padding-top: 8px; display: flex; justify-content: space-between; margin-top: 40px; }
        .footer span { font-size: 9px; color: #bbb; }
        .sig-area { display: flex; justify-content: space-between; margin-top: 40px; gap: 40px; }
        .sig-box { flex: 1; border-top: 1px solid #ccc; padding-top: 8px; font-size: 10px; color: #aaa; text-align: center; }
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
            <h2>{docLabel}</h2>
            <div className="num">N° {number}</div>
            <div className="date">{formatDate(createdAt, locale)}</div>
          </div>
        </div>

        <hr className="divider" />

        <div className="parties">
          <div className="party">
            <div className="party-label">Émetteur</div>
            <h3>GEG Guinée</h3>
            <p>Conakry, Guinée</p>
            {salespersonName && <p style={{ marginTop: "6px", fontSize: "10px", color: "#888" }}>Commercial : {salespersonName}</p>}
          </div>
          <div className="party" style={{ textAlign: "right" }}>
            <div className="party-label">Client</div>
            <h3>{accountName}</h3>
            {accountCountry && <p>{accountCountry}</p>}
          </div>
        </div>

        <div className="meta">
          <div className="meta-item">
            <label>Date</label>
            <span>{formatDate(createdAt, locale)}</span>
          </div>
          {validUntil && (
            <div className="meta-item">
              <label>Valide jusqu&apos;au</label>
              <span>{formatDate(validUntil, locale)}</span>
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
              {docType !== "bon-livraison" && <>
                <th className="right" style={{ width: "20%" }}>Prix unitaire</th>
                <th className="right" style={{ width: "10%" }}>Rem.</th>
                <th className="right" style={{ width: "15%" }}>Montant</th>
              </>}
              {docType === "bon-livraison" && (
                <th style={{ width: "45%" }}>Observations</th>
              )}
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
                  {docType !== "bon-livraison" && <>
                    <td className="right">{formatNumber(l.unit_price)} {currency}</td>
                    <td className="right">{l.discount > 0 ? `${l.discount}%` : "—"}</td>
                    <td className="right" style={{ fontWeight: 600 }}>{formatNumber(sub)}</td>
                  </>}
                  {docType === "bon-livraison" && <td></td>}
                </tr>
              )
            })}
          </tbody>
        </table>

        {docType !== "bon-livraison" && (
          <div className="totals">
            <div className="totals-box">
              <div className="total-row">
                <span>Total HT</span>
                <span style={{ fontWeight: 600, color: "#111" }}>{formatNumber(totalHT)} {currency}</span>
              </div>
              <div className="total-grand">
                <span>TOTAL</span>
                <span>{formatNumber(totalHT)} {currency}</span>
              </div>
            </div>
          </div>
        )}

        {docType === "bon-livraison" && (
          <div className="sig-area">
            <div className="sig-box">Signature livreur<br /><br /><br /></div>
            <div className="sig-box">Signature client<br /><br /><br /></div>
          </div>
        )}

        {notes && (
          <div className="notes-box">{notes}</div>
        )}

        <div className="footer">
          <span>GEG Guinée · Conakry, Guinée</span>
          <span>{number}</span>
          <span>Généré le {new Date().toLocaleDateString("fr")}</span>
        </div>
      </div>
    </>
  )
}
