/**
 * Mise en page print partagée : Devis / Facture / Bon de commande
 * Utilisé avec window.print() — les styles @media print masquent le reste de la page.
 */

interface Settings {
  company_name?: string | null
  tagline?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  rccm?: string | null
  nif?: string | null
  logo_url?: string | null
  footer_text?: string | null
  bank_details?: string | null
  brand_color?: string | null
}

interface Line {
  description: string
  quantity: number
  unit_price: number
  discount: number
  product?: { name: string; reference?: string | null } | null
}

interface DocumentLayoutProps {
  type: "devis" | "facture" | "bon_commande"
  number: string
  date: string
  dueDate?: string | null
  validUntil?: string | null
  status?: string
  settings: Settings
  // Émetteur (pour bon de commande : c'est le fournisseur)
  recipientName: string
  recipientAddress?: string | null
  recipientCountry?: string | null
  lines: Line[]
  notes?: string | null
  currency: string
  locale?: string
}

const TYPE_LABELS: Record<string, string> = {
  devis: "DEVIS",
  facture: "FACTURE",
  bon_commande: "BON DE COMMANDE",
}

function lineTotal(l: Line) {
  return l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100)
}

function fmt(n: number, cur: string) {
  return n.toLocaleString("fr", { maximumFractionDigits: 0 }) + " " + cur
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr", { day: "2-digit", month: "long", year: "numeric" })
}

export default function DocumentLayout({
  type, number, date, dueDate, validUntil, settings,
  recipientName, recipientAddress, recipientCountry,
  lines, notes, currency,
}: DocumentLayoutProps) {
  const color = settings.brand_color ?? "#2563eb"
  const total = lines.reduce((s, l) => s + lineTotal(l), 0)

  return (
    <div className="print-document" style={{ fontFamily: "system-ui, -apple-system, sans-serif", color: "#111" }}>
      <style>{`
        @media print {
          body > *:not(.print-root) { display: none !important; }
          .print-root { display: block !important; }
          .print-document { padding: 0; margin: 0; }
          @page { margin: 15mm 15mm 20mm 15mm; size: A4; }
        }
        .print-document table { width: 100%; border-collapse: collapse; }
        .print-document th, .print-document td { padding: 6px 10px; }
      `}</style>

      {/* ── EN-TÊTE ── */}
      <div style={{ borderTop: `4px solid ${color}`, paddingTop: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          {/* Logo + identité */}
          <div>
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo_url} alt="Logo" style={{ height: 56, objectFit: "contain", marginBottom: 8 }} />
            ) : (
              <div style={{
                width: 48, height: 48, borderRadius: 10, backgroundColor: color,
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8,
              }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 22 }}>
                  {(settings.company_name ?? "G").charAt(0)}
                </span>
              </div>
            )}
            <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 2px" }}>{settings.company_name}</p>
            {settings.tagline && <p style={{ fontSize: 11, color: "#888", margin: 0 }}>{settings.tagline}</p>}
          </div>

          {/* Type + numéro */}
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 26, fontWeight: 800, color, margin: "0 0 4px" }}>{TYPE_LABELS[type]}</p>
            <p style={{ fontSize: 12, fontFamily: "monospace", color: "#555", margin: "0 0 2px" }}>{number}</p>
            <p style={{ fontSize: 11, color: "#888", margin: "0 0 2px" }}>Date : {fmtDate(date)}</p>
            {dueDate && <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Échéance : {fmtDate(dueDate)}</p>}
            {validUntil && <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Valide jusqu'au : {fmtDate(validUntil)}</p>}
          </div>
        </div>
      </div>

      {/* ── ADRESSES ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Émetteur */}
        <div style={{ fontSize: 11, lineHeight: 1.6 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Émetteur</p>
          {settings.address_line1 && <p style={{ margin: 0 }}>{settings.address_line1}</p>}
          {settings.address_line2 && <p style={{ margin: 0 }}>{settings.address_line2}</p>}
          {(settings.city || settings.country) && <p style={{ margin: 0 }}>{[settings.city, settings.country].filter(Boolean).join(", ")}</p>}
          {settings.phone && <p style={{ margin: 0, color: "#555" }}>Tél : {settings.phone}</p>}
          {settings.email && <p style={{ margin: 0, color: "#555" }}>{settings.email}</p>}
          {settings.rccm && <p style={{ margin: 0, color: "#888", fontSize: 10 }}>RCCM : {settings.rccm}</p>}
          {settings.nif && <p style={{ margin: 0, color: "#888", fontSize: 10 }}>NIF : {settings.nif}</p>}
        </div>

        {/* Destinataire */}
        <div style={{ fontSize: 11, lineHeight: 1.6, textAlign: "right" }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            {type === "bon_commande" ? "Fournisseur" : "Facturé à"}
          </p>
          <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 2px" }}>{recipientName}</p>
          {recipientAddress && <p style={{ margin: 0, color: "#555" }}>{recipientAddress}</p>}
          {recipientCountry && <p style={{ margin: 0, color: "#555" }}>{recipientCountry}</p>}
        </div>
      </div>

      {/* ── TABLEAU LIGNES ── */}
      <table style={{ marginBottom: 20 }}>
        <thead>
          <tr style={{ backgroundColor: color }}>
            <th style={{ color: "#fff", fontSize: 11, fontWeight: 600, textAlign: "left", borderRadius: "4px 0 0 4px" }}>Description</th>
            <th style={{ color: "#fff", fontSize: 11, fontWeight: 600, textAlign: "right", width: 60 }}>Qté</th>
            <th style={{ color: "#fff", fontSize: 11, fontWeight: 600, textAlign: "right", width: 110 }}>Prix unitaire</th>
            <th style={{ color: "#fff", fontSize: 11, fontWeight: 600, textAlign: "right", width: 60 }}>Remise</th>
            <th style={{ color: "#fff", fontSize: 11, fontWeight: 600, textAlign: "right", width: 120, borderRadius: "0 4px 4px 0" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#f9fafb" : "#ffffff" }}>
              <td style={{ fontSize: 11, borderBottom: "1px solid #e5e7eb" }}>
                <span style={{ fontWeight: 500 }}>
                  {l.product?.name ?? l.description}
                </span>
                {l.product?.reference && (
                  <span style={{ color: "#999", fontSize: 10, fontFamily: "monospace", marginLeft: 6 }}>
                    [{l.product.reference}]
                  </span>
                )}
                {l.description && l.product && l.description !== l.product.name && (
                  <p style={{ margin: "2px 0 0", color: "#666", fontSize: 10 }}>{l.description}</p>
                )}
              </td>
              <td style={{ fontSize: 11, textAlign: "right", borderBottom: "1px solid #e5e7eb" }}>{l.quantity}</td>
              <td style={{ fontSize: 11, textAlign: "right", borderBottom: "1px solid #e5e7eb" }}>{fmt(l.unit_price, currency)}</td>
              <td style={{ fontSize: 11, textAlign: "right", borderBottom: "1px solid #e5e7eb", color: "#888" }}>
                {l.discount > 0 ? `${l.discount}%` : "—"}
              </td>
              <td style={{ fontSize: 11, textAlign: "right", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>
                {fmt(lineTotal(l), currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── TOTAL ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <div style={{ minWidth: 240 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e5e7eb", fontSize: 12 }}>
            <span style={{ color: "#555" }}>Total HT</span>
            <span style={{ fontWeight: 600 }}>{fmt(total, currency)}</span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            padding: "10px 12px", marginTop: 4,
            backgroundColor: color + "15", borderRadius: 8,
            borderLeft: `3px solid ${color}`,
          }}>
            <span style={{ fontWeight: 700, color, fontSize: 13 }}>
              {type === "devis" ? "Total devis" : type === "bon_commande" ? "Total commande" : "Montant dû"}
            </span>
            <span style={{ fontWeight: 800, color, fontSize: 14 }}>{fmt(total, currency)}</span>
          </div>
        </div>
      </div>

      {/* ── NOTES ── */}
      {notes && (
        <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "#888", textTransform: "uppercase", margin: "0 0 4px" }}>Notes</p>
          <p style={{ fontSize: 11, color: "#444", margin: 0, lineHeight: 1.6 }}>{notes}</p>
        </div>
      )}

      {/* ── PIED DE PAGE ── */}
      {(settings.bank_details || settings.footer_text) && (
        <div style={{ borderTop: `1px solid #e5e7eb`, paddingTop: 12, marginTop: 8 }}>
          {settings.bank_details && (
            <p style={{ fontSize: 10, color: "#555", margin: "0 0 4px", lineHeight: 1.5 }}>{settings.bank_details}</p>
          )}
          {settings.footer_text && (
            <p style={{ fontSize: 10, color: "#888", margin: 0, fontStyle: "italic" }}>{settings.footer_text}</p>
          )}
        </div>
      )}
    </div>
  )
}
