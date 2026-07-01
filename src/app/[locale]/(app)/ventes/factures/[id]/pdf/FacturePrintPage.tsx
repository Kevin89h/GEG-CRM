"use client"

import { useEffect } from "react"
import { formatDate, formatNumber } from "@/lib/utils"

interface Line {
  id: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  tva_rate?: number | null
  product: { name: string; reference: string | null } | null
}

interface BankDetails {
  name?: string
  account?: string
  swift?: string
  iban?: string
  tva_key?: string
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
  footer_text?: string | null
  bank_details?: BankDetails | null
  brand_color?: string | null
}

interface Props {
  number: string
  status: string
  currency: string
  issueDate: string
  dueDate: string | null
  notes: string | null
  sourceRef: string | null
  accountName: string
  accountCity: string | null
  accountCountry: string | null
  accountPhone: string | null
  lines: Line[]
  payments: { amount: number; paid_at: string }[]
  qrSvg: string
  locale: string
  docSettings?: DocSettings | null
}

export default function FacturePrintPage({
  number, status, currency, issueDate, dueDate, notes, sourceRef,
  accountName, accountCity, accountCountry, accountPhone,
  lines, payments, locale, docSettings,
}: Props) {
  useEffect(() => {
    document.title = `Facture ${number}`
  }, [number])

  const color = docSettings?.brand_color ?? "#1e3a5f"
  const colorLight = color + "14"
  const companyName = docSettings?.company_name ?? "Global Energy Group SAS"
  const tagline = docSettings?.tagline ?? "Beyond Limits."
  const addr1 = docSettings?.address_line1 ?? "Imm. Marbella"
  const addr2 = docSettings?.address_line2 ?? null
  const city = docSettings?.city ?? "Lambanyii - Conakry"
  const phone = docSettings?.phone ?? "+224 613 04 40 20"
  const email = docSettings?.email ?? null
  const website = docSettings?.website ?? "www.globalenergy.group"
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

  const hasTva = lines.some(l => (l.tva_rate ?? 0) > 0)
  const defaultTva = hasTva ? 18 : 0

  const totalHT = lines.reduce((s, l) =>
    s + l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100), 0)

  const tvaByRate: Record<number, number> = {}
  for (const l of lines) {
    const rate = l.tva_rate ?? defaultTva
    if (rate > 0) {
      const sub = l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100)
      tvaByRate[rate] = (tvaByRate[rate] ?? 0) + sub * rate / 100
    }
  }
  const totalTva = Object.values(tvaByRate).reduce((s, v) => s + v, 0)
  const totalTTC = totalHT + totalTva
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const balance = totalTTC - totalPaid

  const curSymbol = currency === "GNF" ? "FG" : currency
  const fmtAmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} ${curSymbol}`

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    draft:     { label: "Brouillon",     bg: "#f3f4f6", text: "#6b7280" },
    sent:      { label: "Émise",         bg: "#eff6ff", text: "#1d4ed8" },
    partial:   { label: "Part. réglée",  bg: "#fffbeb", text: "#b45309" },
    paid:      { label: "Payée",         bg: "#f0fdf4", text: "#15803d" },
    cancelled: { label: "Annulée",       bg: "#fef2f2", text: "#b91c1c" },
  }
  const sc = statusConfig[status] ?? statusConfig.sent

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

        /* A4 page shell */
        .page {
          width: 210mm;
          min-height: 297mm;
          margin: 24px auto;
          background: white;
          box-shadow: 0 8px 40px rgba(0,0,0,.22);
          display: flex;
          flex-direction: column;
        }

        /* Content grows, footer sticks to bottom */
        .page-body { flex: 1; display: flex; flex-direction: column; }

        /* ── TOP STRIPE ── */
        .stripe { height: 5px; background: linear-gradient(90deg, ${color} 0%, ${color}88 100%); flex-shrink: 0; }

        /* ── HEADER ── */
        .header {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 22px 24px 18px; border-bottom: 1px solid #eee;
        }
        .tagline { font-size: 22px; font-weight: 900; color: ${color}; letter-spacing: -.5px; margin-bottom: 12px; }
        .co-detail { font-size: 9.5px; color: #666; line-height: 1.75; }
        .co-detail a { color: ${color}; text-decoration: none; font-weight: 600; }
        .company-left { text-align: left; }
        .logo { height: 52px; object-fit: contain; display: block; margin-bottom: 8px; }
        .logo-initials { font-size: 28px; font-weight: 900; color: ${color}; letter-spacing: -1px; margin-bottom: 4px; }
        .co-name { font-size: 12px; font-weight: 800; color: #111; }
        .co-addr { font-size: 9.5px; color: #666; line-height: 1.7; margin-top: 3px; }

        /* ── TITLE ROW ── */
        .title-row {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 20px 24px 0; gap: 20px;
        }
        .bill-to-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #bbb; margin-bottom: 5px; }
        .bill-to-name { font-size: 16px; font-weight: 900; color: #111; }
        .bill-to-detail { font-size: 10px; color: #666; margin-top: 4px; line-height: 1.6; }
        .doc-info { text-align: right; flex-shrink: 0; }
        .doc-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #bbb; margin-bottom: 4px; }
        .doc-number { font-size: 32px; font-weight: 900; color: #111; letter-spacing: -1px; line-height: 1; }
        .status-badge {
          display: inline-block; margin-top: 7px;
          padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 700;
          background: ${sc.bg}; color: ${sc.text};
        }

        /* ── META BAR ── */
        .meta-bar {
          display: flex; margin: 18px 24px; border-radius: 8px; overflow: hidden;
          border: 1px solid #eee; background: #fafafa;
        }
        .meta-cell { flex: 1; padding: 11px 16px; border-right: 1px solid #eee; }
        .meta-cell:last-child { border-right: none; }
        .meta-cell label { display: block; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: ${color}; margin-bottom: 5px; }
        .meta-cell span { font-size: 11.5px; font-weight: 700; color: #111; }

        /* ── TABLE ── */
        .table-wrap { padding: 0 24px; }
        table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        thead tr { background: ${color}; }
        thead th { padding: 10px 11px; text-align: left; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: white; }
        .th-r { text-align: right; }
        tbody tr { border-bottom: 1px solid #f0f0f0; }
        tbody tr:last-child { border-bottom: 2px solid #ddd; }
        tbody td { padding: 10px 11px; vertical-align: top; }
        .td-r { text-align: right; }
        .td-desc { font-weight: 600; color: #111; line-height: 1.45; }
        .td-muted { font-size: 9px; color: #999; margin-top: 2px; }

        /* ── NOTES ── */
        .notes-box {
          margin: 16px 24px 0;
          border-left: 3px solid ${color};
          background: ${colorLight};
          padding: 10px 14px;
          font-size: 10px; color: #555; line-height: 1.65;
          border-radius: 0 6px 6px 0;
        }

        /* ── BOTTOM SECTION ── */
        .bottom {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 20px 24px 24px; gap: 24px; flex: 1;
        }

        /* BANK ACCOUNTS */
        .bank-section { flex: 1; }
        .bank-section-title {
          font-size: 8.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .9px; color: #888; margin-bottom: 12px;
          padding-bottom: 6px; border-bottom: 1px solid #eee;
        }
        .bank-currency-group { margin-bottom: 14px; }
        .bank-currency-group:last-child { margin-bottom: 0; }
        .bank-currency-label {
          font-size: 8px; font-weight: 700; color: white;
          background: ${color}; padding: 2px 8px; border-radius: 10px;
          display: inline-block; margin-bottom: 8px; letter-spacing: .5px;
        }
        .bank-row { display: flex; gap: 8px; padding: 4px 0; font-size: 10px; align-items: baseline; }
        .bank-inst { font-weight: 700; color: #111; min-width: 90px; }
        .bank-num { color: #555; font-family: 'Courier New', monospace; font-size: 9.5px; }
        .bank-meta { font-size: 9px; color: #999; margin-top: 4px; padding-left: 2px; }

        /* TOTALS */
        .totals-block { width: 240px; flex-shrink: 0; }
        .payment-comm {
          font-size: 9px; color: #aaa; margin-bottom: 12px;
          font-style: italic; line-height: 1.5;
        }
        .payment-comm strong { color: ${color}; font-style: normal; }
        .tot-row {
          display: flex; justify-content: space-between;
          padding: 6px 0; font-size: 10.5px; color: #555;
          border-bottom: 1px solid #f0f0f0;
        }
        .tot-ttc {
          font-weight: 800; font-size: 13.5px; color: #111;
          border-bottom: 2px solid ${color} !important;
          border-top: 1px solid #ddd; padding: 8px 0;
        }
        .tot-paid { color: #059669; font-size: 10px; }
        .tot-balance { font-weight: 800; font-size: 12px; color: #dc2626; padding-top: 7px; border-bottom: none !important; }
        .tot-cleared { font-weight: 800; font-size: 12px; color: #059669; padding-top: 7px; border-bottom: none !important; }

        /* ── FOOTER ── */
        .footer-bar {
          background: ${color};
          padding: 11px 24px;
          display: flex; justify-content: center; align-items: center;
          gap: 0; flex-shrink: 0; flex-wrap: wrap;
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
            <div className="company-left">
              {logoUrl
                ? <img src={logoUrl} alt={companyName} className="logo" />
                : <div className="logo-initials">
                    {companyName.split(" ").map((w: string) => w[0]).join("").slice(0, 3)}
                  </div>
              }
              <div className="co-name">{companyName}</div>
              <div className="co-addr">
                {nif && <>NIF : {nif}<br /></>}
                {rccm && <>RCCM : {rccm}</>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="tagline">{tagline}</div>
              <div className="co-detail">
                {addr1}{addr2 ? `, ${addr2}` : ""}<br />
                {city}<br />
                {phone && <>Tél. : {phone}<br /></>}
                {email && <>{email}<br /></>}
                {website && <a href={`https://${website.replace(/^https?:\/\//, "")}`}>{website}</a>}
              </div>
            </div>
          </div>

          {/* TITLE ROW */}
          <div className="title-row">
            <div>
              <div className="bill-to-label">Facturé à</div>
              <div className="bill-to-name">{accountName}</div>
              {(accountCity || accountCountry) && (
                <div className="bill-to-detail">
                  {[accountCity, accountCountry].filter(Boolean).join(", ")}
                </div>
              )}
              {accountPhone && <div className="bill-to-detail">{accountPhone}</div>}
            </div>
            <div className="doc-info">
              <div className="doc-label">Facture</div>
              <div className="doc-number">{number}</div>
              <div><span className="status-badge">{sc.label}</span></div>
            </div>
          </div>

          {/* META BAR */}
          <div className="meta-bar">
            <div className="meta-cell">
              <label>Date de la facture</label>
              <span>{formatDate(issueDate, locale)}</span>
            </div>
            {dueDate && (
              <div className="meta-cell">
                <label>Date d&apos;échéance</label>
                <span>{formatDate(dueDate, locale)}</span>
              </div>
            )}
            {sourceRef && (
              <div className="meta-cell">
                <label>Référence</label>
                <span>{sourceRef}</span>
              </div>
            )}
            <div className="meta-cell">
              <label>Devise</label>
              <span>{currency}</span>
            </div>
          </div>

          {/* LINES TABLE */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: hasTva ? "42%" : "52%" }}>Description</th>
                  <th className="th-r" style={{ width: "10%" }}>Qté</th>
                  <th className="th-r" style={{ width: "18%" }}>Prix unitaire</th>
                  {hasTva && <th className="th-r" style={{ width: "12%" }}>Taxes</th>}
                  <th className="th-r" style={{ width: hasTva ? "18%" : "20%" }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(l => {
                  const disc = 1 - (l.discount ?? 0) / 100
                  const sub = l.quantity * l.unit_price * disc
                  const rate = l.tva_rate ?? defaultTva
                  return (
                    <tr key={l.id}>
                      <td>
                        <div className="td-desc">{l.description}</div>
                        {l.discount > 0 && (
                          <div className="td-muted">Remise {l.discount}%</div>
                        )}
                      </td>
                      <td className="td-r">{formatNumber(l.quantity, 2)} U</td>
                      <td className="td-r">{formatNumber(l.unit_price, 0)} {curSymbol}</td>
                      {hasTva && (
                        <td className="td-r" style={{ fontSize: "9px", color: "#999" }}>
                          {rate > 0 ? `TVA ${rate}%` : "—"}
                        </td>
                      )}
                      <td className="td-r" style={{ fontWeight: 700 }}>
                        {formatNumber(sub, 0)} {curSymbol}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {notes && <div className="notes-box">{notes}</div>}

          {/* BOTTOM: BANK + TOTALS */}
          <div className="bottom">
            {/* BANK ACCOUNTS */}
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

            {/* TOTALS */}
            <div className="totals-block">
              <div className="payment-comm">
                Communication de paiement :<br /><strong>{number}</strong>
              </div>
              {hasTva && (
                <div className="tot-row">
                  <span>Montant hors taxes</span>
                  <span>{fmtAmt(totalHT)}</span>
                </div>
              )}
              {Object.entries(tvaByRate).map(([rate, amt]) => (
                <div className="tot-row" key={rate}>
                  <span>TVA {rate}%</span>
                  <span>{fmtAmt(amt)}</span>
                </div>
              ))}
              <div className="tot-row tot-ttc">
                <span>Total</span>
                <span>{fmtAmt(totalTTC)}</span>
              </div>
              {payments.map((p, i) => (
                <div className="tot-row tot-paid" key={i}>
                  <span>Versement {formatDate(p.paid_at.slice(0, 10), locale)}</span>
                  <span>− {fmtAmt(p.amount)}</span>
                </div>
              ))}
              {payments.length > 0 && (
                <div className={`tot-row ${balance <= 0 ? "tot-cleared" : "tot-balance"}`}>
                  <span>Solde dû</span>
                  <span>{balance <= 0 ? "✓ Soldé" : fmtAmt(balance)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER — collé en bas */}
        <div className="footer-bar">
          {phone && (
            <div className="footer-item">
              <span>📞</span>
              <strong>{phone}</strong>
            </div>
          )}
          {phone && email && <div className="footer-divider" />}
          {email && (
            <div className="footer-item">
              <span>✉</span>
              <strong>{email}</strong>
            </div>
          )}
          {(phone || email) && website && <div className="footer-divider" />}
          {website && (
            <div className="footer-item">
              <span>🌐</span>
              <strong>{website}</strong>
            </div>
          )}
          {website && nif && <div className="footer-divider" />}
          {nif && (
            <div className="footer-item">
              <span style={{ opacity: .65, fontSize: "8.5px" }}>NIF</span>
              <strong>{nif}</strong>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
