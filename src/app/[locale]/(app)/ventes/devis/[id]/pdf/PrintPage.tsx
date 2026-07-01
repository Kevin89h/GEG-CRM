"use client"

import { useEffect } from "react"
import { formatDate, formatNumber } from "@/lib/utils"

interface Line {
  id: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  tva_rate?: number
  product: { name: string; reference: string | null } | null
}

interface BankDetails {
  swift?: string
  tva_key?: string
}

interface DocSettings {
  company_name?: string | null
  tagline?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  nif?: string | null
  rccm?: string | null
  logo_url?: string | null
  tva_rate?: number | null
  brand_color?: string | null
  bank_details?: BankDetails | null
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
  deliveryAddress?: string | null
  paymentTerms?: string | null
  lines: Line[]
  locale: string
  docType: "devis" | "bon-livraison"
  docSettings?: DocSettings | null
}

export default function PrintPage({
  number, status, currency, createdAt, validUntil, notes,
  accountName, accountCountry, salespersonName, deliveryAddress, paymentTerms,
  lines, locale, docType, docSettings,
}: Props) {
  useEffect(() => {
    document.title = `${docType === "bon-livraison" ? "BL" : status === "confirmed" ? "BC" : "DEVIS"} - ${number}`
  }, [number, status, docType])

  const color = docSettings?.brand_color ?? "#1e3a5f"
  const colorLight = color + "14"
  const tvaRate = docSettings?.tva_rate ?? 0
  const companyName = docSettings?.company_name ?? "Global Energy Group SAS"
  const tagline = docSettings?.tagline ?? "Beyond Limits."
  const addr1 = docSettings?.address_line1 ?? "Imm. Marbella"
  const addr2 = docSettings?.address_line2 ?? null
  const city = docSettings?.city ?? "Lambanyii - Conakry"
  const phone = docSettings?.phone ?? "+224 613 04 40 20"
  const email = docSettings?.email ?? null
  const website = docSettings?.website ?? "www.globalenergygroup.com"
  const nif = docSettings?.nif ?? "446243099"
  const rccm = docSettings?.rccm ?? null
  const logoUrl = docSettings?.logo_url ?? null
  const bankMeta = (docSettings?.bank_details as BankDetails | null) ?? { swift: "ECOCGNCN", tva_key: "5X" }

  const BANK_ACCOUNTS = [
    { institution: "ECOBANK",     account_number: "10001730805226290" },
    { institution: "ECOBANK",     account_number: "100017308064086" },
    { institution: "ACCESS BANK", account_number: "36001010000215460" },
    { institution: "VISTA BANK",  account_number: "2842400145744130" },
  ]

  const docLabel = docType === "bon-livraison" ? "BON DE LIVRAISON"
    : status === "confirmed" ? "BON DE COMMANDE"
    : "DEVIS"

  const totalHT = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100), 0)
  const tvaAmt = totalHT * tvaRate / 100
  const totalTTC = totalHT + tvaAmt
  const cur = currency === "GNF" ? "FG" : currency

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #111; background: #d0d0d0; }
        .no-print { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; z-index: 999; }
        .btn { padding: 10px 22px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: opacity .15s; }
        .btn:hover { opacity: .85; }
        .btn-primary { background: ${color}; color: white; }
        .btn-secondary { background: #e5e5e5; color: #333; }

        .page { width: 210mm; min-height: 297mm; margin: 24px auto; background: white; box-shadow: 0 8px 40px rgba(0,0,0,.22); display: flex; flex-direction: column; position: relative; overflow: hidden; }
        .page::before { content: "G"; position: absolute; font-size: 480px; font-weight: 900; color: ${color}; opacity: 0.04; right: -60px; top: 50%; transform: translateY(-50%); line-height: 1; pointer-events: none; z-index: 0; font-family: 'Helvetica Neue', Arial, sans-serif; }
        .page-body { flex: 1; display: flex; flex-direction: column; position: relative; z-index: 1; }
        .footer-bar { position: relative; z-index: 1; }

        .stripe { height: 5px; background: linear-gradient(90deg, ${color} 0%, ${color}88 100%); flex-shrink: 0; }

        /* HEADER */
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 22px 24px 18px; border-bottom: 1px solid #eee; }
        .tagline { font-size: 22px; font-weight: 900; color: ${color}; letter-spacing: -.5px; margin-bottom: 12px; }
        .co-detail { font-size: 9.5px; color: #666; line-height: 1.75; }
        .co-detail a { color: ${color}; text-decoration: none; font-weight: 600; }
        .logo { height: 52px; object-fit: contain; display: block; margin-bottom: 8px; }
        .logo-initials { font-size: 28px; font-weight: 900; color: ${color}; letter-spacing: -1px; margin-bottom: 4px; }
        .co-name { font-size: 12px; font-weight: 800; color: #111; }
        .co-addr { font-size: 9.5px; color: #666; line-height: 1.7; margin-top: 3px; }

        /* TITLE ROW */
        .title-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px 0; gap: 20px; }
        .bill-to-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #bbb; margin-bottom: 5px; }
        .bill-to-name { font-size: 16px; font-weight: 900; color: #111; }
        .bill-to-detail { font-size: 10px; color: #666; margin-top: 4px; line-height: 1.6; }
        .doc-info { text-align: right; flex-shrink: 0; }
        .doc-label-text { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #bbb; margin-bottom: 4px; }
        .doc-number { font-size: 30px; font-weight: 900; color: #111; letter-spacing: -1px; line-height: 1; }
        .doc-type-badge {
          display: inline-block; margin-top: 7px;
          padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 700;
          background: ${color}18; color: ${color};
        }

        /* META BAR */
        .meta-bar { display: flex; margin: 18px 24px; border-radius: 8px; overflow: hidden; border: 1px solid #eee; background: #fafafa; }
        .meta-cell { flex: 1; padding: 11px 16px; border-right: 1px solid #eee; }
        .meta-cell:last-child { border-right: none; }
        .meta-cell label { display: block; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: ${color}; margin-bottom: 5px; }
        .meta-cell span { font-size: 11.5px; font-weight: 700; color: #111; }

        /* TABLE */
        .table-wrap { padding: 0 24px; }
        table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        thead tr { background: ${color}; }
        thead th { padding: 10px 11px; text-align: left; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: white; }
        .th-r { text-align: right; }
        tbody tr { border-bottom: 1px solid #d0d0d0; }
        tbody tr:nth-child(even) { background: #f5f5f5; }
        tbody tr:last-child { border-bottom: 2px solid #bbb; }
        tbody td { padding: 10px 11px; vertical-align: top; }
        .td-r { text-align: right; }
        .td-desc { font-weight: 600; color: #111; line-height: 1.45; }
        .td-muted { font-size: 9px; color: #999; margin-top: 2px; }

        /* TOTALS */
        .totals-wrap { display: flex; justify-content: flex-end; padding: 12px 24px 0; }
        .totals-table { width: 260px; font-size: 10.5px; border-collapse: collapse; }
        .totals-table td { padding: 5px 8px; color: #555; }
        .tot-ttc { font-weight: 800; font-size: 13px; color: #111 !important; border-top: 2px solid ${color}; }

        /* NOTES */
        .notes-box { margin: 14px 24px 0; border-left: 3px solid ${color}; background: ${colorLight}; padding: 10px 14px; font-size: 10px; color: #555; line-height: 1.65; border-radius: 0 6px 6px 0; }

        /* SIGNATURES BL */
        .sig-area { display: flex; justify-content: space-between; margin: 40px 24px 0; gap: 40px; }
        .sig-box { flex: 1; border-top: 1px solid #ccc; padding-top: 8px; font-size: 10px; color: #aaa; text-align: center; }

        /* BOTTOM */
        .bottom { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px 24px; gap: 24px; flex: 1; margin-top: 8px; }

        /* BANK */
        .bank-section { flex: 1; }
        .bank-section-title { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .9px; color: #888; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
        .bank-currency-group { margin-bottom: 14px; }
        .bank-currency-group:last-child { margin-bottom: 0; }
        .bank-currency-label { font-size: 8px; font-weight: 700; color: white; background: ${color}; padding: 2px 8px; border-radius: 10px; display: inline-block; margin-bottom: 8px; }
        .bank-row { display: flex; gap: 10px; padding: 5px 0; font-size: 10.5px; align-items: baseline; border-bottom: 1px solid #f0f0f0; }
        .bank-inst { font-weight: 800; color: #111; min-width: 100px; }
        .bank-num { color: #111; font-family: 'Courier New', monospace; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; }
        .bank-meta { font-size: 9px; color: #999; margin-top: 4px; padding-left: 2px; }

        /* CONDITIONS */
        .conditions-block { flex: 1; }
        .conditions-title { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .9px; color: #888; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
        .cond-item { font-size: 10px; color: #555; line-height: 1.7; margin-bottom: 4px; }
        .cond-label { font-weight: 700; color: #333; }

        /* FOOTER */
        .footer-bar { background: ${color}; padding: 11px 24px; display: flex; justify-content: center; align-items: center; gap: 0; flex-shrink: 0; flex-wrap: wrap; }
        .footer-item { display: flex; align-items: center; gap: 5px; color: rgba(255,255,255,.9); font-size: 9.5px; padding: 0 14px; }
        .footer-item strong { color: white; }
        .footer-divider { width: 1px; height: 18px; background: rgba(255,255,255,.25); }

        @media print {
          html, body { background: white; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 0; }
          .page { margin: 0 !important; box-shadow: none !important; width: 210mm; min-height: 297mm; }
        }
      `}</style>

      <div className="no-print">
        <button className="btn btn-secondary" onClick={() => window.close()}>✕ Fermer</button>
        <button className="btn btn-primary" onClick={() => window.print()}>⬇ Télécharger PDF</button>
      </div>

      <div className="page">
        <div className="stripe" />

        <div className="page-body">
          {/* HEADER */}
          <div className="header">
            <div>
              {logoUrl
                ? <img src={logoUrl} alt={companyName} className="logo" />
                : <div className="logo-initials">{companyName.split(" ").map((w: string) => w[0]).join("").slice(0, 3)}</div>
              }
              <div className="co-name">{companyName}</div>
              <div className="co-detail">
                {addr1}{addr2 ? `, ${addr2}` : ""}<br />
                {city}
              </div>
            </div>
            <div className="tagline">{tagline}</div>
          </div>

          {/* TITLE ROW */}
          <div className="title-row">
            <div>
              <div className="bill-to-label">Adressé à</div>
              <div className="bill-to-name">{accountName}</div>
              {accountCountry && <div className="bill-to-detail">{accountCountry}</div>}
            </div>
            <div className="doc-info">
              <div className="doc-label-text">{docLabel}</div>
              <div className="doc-number">{number}</div>
              <div><span className="doc-type-badge">{docLabel}</span></div>
            </div>
          </div>

          {/* META BAR */}
          <div className="meta-bar">
            <div className="meta-cell">
              <label>Date</label>
              <span>{formatDate(createdAt, locale)}</span>
            </div>
            {validUntil && (
              <div className="meta-cell">
                <label>Valide jusqu&apos;au</label>
                <span>{formatDate(validUntil, locale)}</span>
              </div>
            )}
            {salespersonName && (
              <div className="meta-cell">
                <label>Vendeur</label>
                <span>{salespersonName}</span>
              </div>
            )}
            <div className="meta-cell">
              <label>Devise</label>
              <span>{currency}</span>
            </div>
          </div>

          {/* TABLE */}
          <div className="table-wrap">
            {docType !== "bon-livraison" ? (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "44%" }}>Description</th>
                    <th className="th-r" style={{ width: "12%" }}>Qté</th>
                    <th className="th-r" style={{ width: "20%" }}>Prix unitaire</th>
                    {tvaRate > 0 && <th className="th-r" style={{ width: "10%" }}>TVA</th>}
                    <th className="th-r" style={{ width: tvaRate > 0 ? "14%" : "24%" }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => {
                    const sub = l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100)
                    const lineTva = l.tva_rate ?? tvaRate
                    return (
                      <tr key={l.id}>
                        <td>
                          <div className="td-desc">{l.description}</div>
                          {l.discount > 0 && <div className="td-muted">Remise {l.discount}%</div>}
                        </td>
                        <td className="td-r">{formatNumber(l.quantity, 2)} U</td>
                        <td className="td-r">{formatNumber(l.unit_price, 0)} {cur}</td>
                        {tvaRate > 0 && <td className="td-r" style={{ fontSize: "9px", color: "#999" }}>{lineTva > 0 ? `${lineTva}%` : "—"}</td>}
                        <td className="td-r" style={{ fontWeight: 700 }}>{formatNumber(sub, 0)} {cur}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "55%" }}>Description</th>
                    <th className="th-r" style={{ width: "20%" }}>Quantité</th>
                    <th style={{ width: "25%" }}>Observations</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => (
                    <tr key={l.id}>
                      <td><div className="td-desc">{l.description}</div></td>
                      <td className="td-r">{formatNumber(l.quantity, 2)} U</td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* TOTALS */}
          {docType !== "bon-livraison" && (
            <div className="totals-wrap">
              <table className="totals-table">
                <tbody>
                  <tr>
                    <td>Montant hors taxes</td>
                    <td style={{ textAlign: "right" }}>{formatNumber(totalHT, 0)} {cur}</td>
                  </tr>
                  {tvaAmt > 0 && (
                    <tr>
                      <td>TVA {tvaRate}%</td>
                      <td style={{ textAlign: "right" }}>{formatNumber(tvaAmt, 0)} {cur}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="tot-ttc">Total</td>
                    <td className="tot-ttc" style={{ textAlign: "right" }}>{formatNumber(totalTTC, 0)} {cur}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {notes && <div className="notes-box">{notes}</div>}

          {docType === "bon-livraison" && (
            <div className="sig-area">
              <div className="sig-box">Signature livreur<br /><br /><br /></div>
              <div className="sig-box">Signature client<br /><br /><br /></div>
            </div>
          )}

          {/* BOTTOM: BANK + CONDITIONS */}
          <div className="bottom">
            {/* BANK ACCOUNTS */}
            {docType !== "bon-livraison" && (
              <div className="bank-section">
                <div className="bank-section-title">Coordonnées bancaires — GNF</div>
                {BANK_ACCOUNTS.map(acc => (
                  <div className="bank-row" key={acc.account_number}>
                    <span className="bank-inst">{acc.institution}</span>
                    <span className="bank-num">{acc.account_number}</span>
                  </div>
                ))}
                <div className="bank-meta">
                  {bankMeta.swift && <>Swift : {bankMeta.swift}</>}
                  {bankMeta.swift && bankMeta.tva_key && "  ·  "}
                  {bankMeta.tva_key && <>Clé TVA : {bankMeta.tva_key}</>}
                </div>
              </div>
            )}

            {/* CONDITIONS */}
            {(deliveryAddress || paymentTerms) && (
              <div className="conditions-block">
                <div className="conditions-title">Conditions</div>
                {deliveryAddress && (
                  <div className="cond-item"><span className="cond-label">Livraison : </span>{deliveryAddress}</div>
                )}
                {paymentTerms && (
                  <div className="cond-item"><span className="cond-label">Paiement : </span>{paymentTerms}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER — collé en bas */}
        <div className="footer-bar">
          {phone && (
            <div className="footer-item"><span>📞</span><strong>{phone}</strong></div>
          )}
          {phone && email && <div className="footer-divider" />}
          {email && (
            <div className="footer-item"><span>✉</span><strong>{email}</strong></div>
          )}
          {(phone || email) && website && <div className="footer-divider" />}
          {website && (
            <div className="footer-item"><span>🌐</span><strong>{website}</strong></div>
          )}
          {website && nif && <div className="footer-divider" />}
          {nif && (
            <div className="footer-item"><span style={{ opacity: .65, fontSize: "8.5px" }}>NIF</span><strong>{nif}</strong></div>
          )}
        </div>
      </div>
    </>
  )
}
