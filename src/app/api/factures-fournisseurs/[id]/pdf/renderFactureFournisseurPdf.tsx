import React from "react"
import {
  Document, Page, View, Text, Image, StyleSheet, Font, renderToBuffer,
} from "@react-pdf/renderer"

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
  ],
})

function fmt(value: number, decimals = 0): string {
  const parts = value.toFixed(decimals).split(".")
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return decimals > 0 ? parts.join(",") : parts[0]
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
  } catch { return iso }
}

interface Line {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
}

interface SupplierPayment {
  amount: number
  currency: string
  paid_at: string
}

interface Props {
  number: string
  status: string
  currency: string
  supplierName: string
  invoiceDate: string
  dueDate: string | null
  reference: string | null
  notes: string | null
  lines: Line[]
  payments: SupplierPayment[]
  totalHt: number
  taxAmount: number
  totalTtc: number
  totalPaid: number
  balance: number
  docSettings: Record<string, unknown> | null
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: "Brouillon",  bg: "#f3f4f6", text: "#6b7280" },
  pending:   { label: "En attente", bg: "#fffbeb", text: "#b45309" },
  partial:   { label: "Part. réglée", bg: "#eff6ff", text: "#1d4ed8" },
  paid:      { label: "Payée",      bg: "#f0fdf4", text: "#15803d" },
  cancelled: { label: "Annulée",    bg: "#fef2f2", text: "#b91c1c" },
}

export async function renderFactureFournisseurPdf(props: Props): Promise<Buffer> {
  const {
    number, status, currency, supplierName, invoiceDate, dueDate, reference, notes,
    lines, payments, totalHt, taxAmount, totalTtc, balance, docSettings: ds,
  } = props

  const color = (ds?.brand_color as string) ?? "#1e3a5f"
  const companyName = (ds?.company_name as string) ?? "Global Energy Group SAS"
  const tagline = (ds?.tagline as string) ?? "Beyond Limits."
  const addr1 = (ds?.address_line1 as string) ?? "Imm. Marbella"
  const city = (ds?.city as string) ?? "Lambanyii - Conakry"
  const phone = (ds?.phone as string) ?? "+224 613 04 40 20"
  const email = (ds?.email as string) ?? null
  const website = (ds?.website as string) ?? "www.globalenergygroup.com"
  const nif = (ds?.nif as string) ?? "446243099"
  const logoUrl = (ds?.logo_url as string) ?? null

  const lc = (ds?.layout_config as Record<string, unknown>) ?? {}
  const showStripe      = lc.show_stripe         !== false
  const showLogo        = lc.show_logo            !== false
  const showTagline     = lc.show_tagline         !== false
  const showCompanyAddr = lc.show_company_address !== false
  const showNotes       = lc.show_notes           !== false
  const showFooterPhone   = lc.show_footer_phone   !== false
  const showFooterWebsite = lc.show_footer_website !== false
  const showFooterNif     = lc.show_footer_nif     !== false
  const showFooterEmail   = lc.show_footer_email   !== false

  const sc = statusConfig[status] ?? statusConfig.pending
  const cur = currency === "GNF" ? "FG" : currency
  const fmtAmt = (n: number) => `${fmt(Math.round(n))} ${cur}`

  const hasTva = lines.some(l => (l.tax_rate ?? 0) > 0)

  const s = StyleSheet.create({
    page: { fontFamily: "Helvetica", fontSize: 9, color: "#111", backgroundColor: "#fff", padding: 0 },
    content: { flex: 1, paddingBottom: 40 },
    stripe: { height: 4, backgroundColor: color },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: "14 20 12 20", borderBottomWidth: 1, borderBottomColor: "#eee" },
    logo: { height: 44, marginBottom: 6, objectFit: "contain" as const },
    coName: { fontSize: 11, fontFamily: "Helvetica", fontWeight: "bold", color: "#111", marginBottom: 2 },
    coDetail: { fontSize: 8, color: "#777", lineHeight: 1.6 },
    tagline: { fontSize: 18, fontFamily: "Helvetica", fontWeight: "bold", color, letterSpacing: -0.5 },
    titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: "14 20 0 20" },
    fromLabel: { fontSize: 7, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
    fromName: { fontSize: 14, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    fromDetail: { fontSize: 8, color: "#777", marginTop: 2 },
    docInfo: { alignItems: "flex-end" },
    docLabelText: { fontSize: 7, color: "#bbb", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 3 },
    docNumber: { fontSize: 22, fontFamily: "Helvetica", fontWeight: "bold", color: "#111", letterSpacing: -1 },
    badge: { marginTop: 5, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 10 },
    badgeText: { fontSize: 8, fontFamily: "Helvetica", fontWeight: "bold" },
    metaBar: { flexDirection: "row", margin: "10 20 0 20", borderWidth: 1, borderColor: "#eee", borderRadius: 6, overflow: "hidden", backgroundColor: "#fafafa" },
    metaCell: { flex: 1, padding: "8 12", borderRightWidth: 1, borderRightColor: "#eee" },
    metaCellLast: { flex: 1, padding: "8 12" },
    metaLabel: { fontSize: 7, color, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3, fontFamily: "Helvetica", fontWeight: "bold" },
    metaValue: { fontSize: 9, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    tableWrap: { margin: "10 20 0 20" },
    tableHeader: { flexDirection: "row", backgroundColor: color, padding: "7 8" },
    thText: { fontSize: 7.5, color: "#fff", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Helvetica", fontWeight: "bold" },
    tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd", padding: "7 8", alignItems: "flex-start" },
    tableRowEven: { backgroundColor: "#f7f7f7" },
    tdDesc: { fontSize: 8.5, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    tdR: { textAlign: "right" },
    tdAmt: { fontSize: 8.5, fontFamily: "Helvetica", fontWeight: "bold", textAlign: "right" },
    notesBox: { margin: "10 20 0 20", borderLeftWidth: 3, borderLeftColor: color, backgroundColor: color + "14", padding: "8 10", borderRadius: 4 },
    notesText: { fontSize: 8.5, color: "#555", lineHeight: 1.6 },
    bottomWrap: { flexDirection: "row", margin: "12 20 0 20", gap: 20 },
    totalsBlock: { width: 230, flexShrink: 0 },
    totRow: { flexDirection: "row", justifyContent: "space-between", padding: "3 0", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
    totLabel: { fontSize: 9, color: "#555" },
    totValue: { fontSize: 9, color: "#555" },
    totTTC: { flexDirection: "row", justifyContent: "space-between", padding: "6 0", borderTopWidth: 2, borderTopColor: color, borderBottomWidth: 2, borderBottomColor: color, marginTop: 2 },
    totTTCText: { fontSize: 11, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    totPaid: { flexDirection: "row", justifyContent: "space-between", padding: "3 0", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
    totPaidLabel: { fontSize: 8.5, color: "#059669" },
    totPaidValue: { fontSize: 8.5, color: "#059669" },
    totBalance: { flexDirection: "row", justifyContent: "space-between", padding: "5 0" },
    totBalanceLabel: { fontSize: 10, fontFamily: "Helvetica", fontWeight: "bold", color: "#dc2626" },
    totBalanceValue: { fontSize: 10, fontFamily: "Helvetica", fontWeight: "bold", color: "#dc2626" },
    totCleared: { fontSize: 10, fontFamily: "Helvetica", fontWeight: "bold", color: "#059669" },
    footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: color, flexDirection: "row", justifyContent: "center", alignItems: "center", padding: "9 20", flexWrap: "wrap", gap: 0 },
    footerItem: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12 },
    footerText: { fontSize: 8, color: "#fff" },
    footerDivider: { width: 1, height: 14, backgroundColor: "rgba(255,255,255,0.3)" },
  })

  const doc = (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.content}>
          {showStripe && <View style={s.stripe} />}

          {/* Header */}
          <View style={s.header}>
            <View>
              {showLogo && logoUrl
                ? <Image src={logoUrl} style={s.logo} />
                : <Text style={s.coName}>{companyName}</Text>
              }
              {showLogo && logoUrl && <Text style={s.coName}>{companyName}</Text>}
              {showCompanyAddr && <Text style={s.coDetail}>{addr1}{"\n"}{city}</Text>}
            </View>
            {showTagline && <Text style={s.tagline}>{tagline}</Text>}
          </View>

          {/* Title row */}
          <View style={s.titleRow}>
            <View>
              <Text style={s.fromLabel}>Fournisseur</Text>
              <Text style={s.fromName}>{supplierName}</Text>
              {reference && <Text style={s.fromDetail}>Réf. fournisseur : {reference}</Text>}
            </View>
            <View style={s.docInfo}>
              <Text style={s.docLabelText}>Facture fournisseur</Text>
              <Text style={s.docNumber}>{number}</Text>
              <View style={[s.badge, { backgroundColor: sc.bg }]}>
                <Text style={[s.badgeText, { color: sc.text }]}>{sc.label}</Text>
              </View>
            </View>
          </View>

          {/* Meta bar */}
          <View style={s.metaBar}>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Date de la facture</Text>
              <Text style={s.metaValue}>{fmtDate(invoiceDate)}</Text>
            </View>
            {dueDate && (
              <View style={s.metaCell}>
                <Text style={s.metaLabel}>{"Date d'échéance"}</Text>
                <Text style={s.metaValue}>{fmtDate(dueDate)}</Text>
              </View>
            )}
            <View style={s.metaCellLast}>
              <Text style={s.metaLabel}>Devise</Text>
              <Text style={s.metaValue}>{currency}</Text>
            </View>
          </View>

          {/* Lines table */}
          <View style={s.tableWrap}>
            <View style={s.tableHeader}>
              <Text style={[s.thText, { flex: 4 }]}>Description</Text>
              <Text style={[s.thText, { width: 50, textAlign: "right" }]}>Qté</Text>
              <Text style={[s.thText, { width: 80, textAlign: "right" }]}>Prix unit.</Text>
              {hasTva && <Text style={[s.thText, { width: 40, textAlign: "right" }]}>TVA</Text>}
              <Text style={[s.thText, { width: 80, textAlign: "right" }]}>Montant</Text>
            </View>
            {lines.map((l, i) => {
              const sub = l.quantity * l.unit_price
              const total = sub * (1 + l.tax_rate / 100)
              return (
                <View key={l.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowEven : {}]} wrap={false}>
                  <View style={{ flex: 4 }}>
                    <Text style={s.tdDesc}>{l.description}</Text>
                  </View>
                  <Text style={[{ width: 50, fontSize: 8.5, color: "#333" }, s.tdR]}>{fmt(l.quantity, 2)}</Text>
                  <Text style={[{ width: 80, fontSize: 8.5, color: "#333" }, s.tdR]}>{fmt(l.unit_price, 0)} {cur}</Text>
                  {hasTva && (
                    <Text style={[{ width: 40, fontSize: 8, color: "#aaa" }, s.tdR]}>
                      {l.tax_rate > 0 ? `${l.tax_rate}%` : "—"}
                    </Text>
                  )}
                  <Text style={[{ width: 80 }, s.tdAmt]}>{fmt(Math.round(total), 0)} {cur}</Text>
                </View>
              )
            })}
          </View>

          {showNotes && notes && (
            <View style={s.notesBox}>
              <Text style={s.notesText}>{notes}</Text>
            </View>
          )}

          {/* Totals */}
          <View style={s.bottomWrap} wrap={false}>
            <View style={{ flex: 1 }} />
            <View style={s.totalsBlock}>
              {hasTva && (
                <View style={s.totRow}>
                  <Text style={s.totLabel}>Montant HT</Text>
                  <Text style={s.totValue}>{fmtAmt(totalHt)}</Text>
                </View>
              )}
              {hasTva && taxAmount > 0 && (
                <View style={s.totRow}>
                  <Text style={s.totLabel}>TVA</Text>
                  <Text style={s.totValue}>{fmtAmt(taxAmount)}</Text>
                </View>
              )}
              <View style={s.totTTC}>
                <Text style={s.totTTCText}>Total TTC</Text>
                <Text style={s.totTTCText}>{fmtAmt(totalTtc)}</Text>
              </View>
              {payments.map((p, i) => (
                <View key={i} style={s.totPaid}>
                  <Text style={s.totPaidLabel}>Paiement {fmtDate(p.paid_at.slice(0, 10))}</Text>
                  <Text style={s.totPaidValue}>− {fmt(Math.round(p.amount), 0)} {p.currency === "GNF" ? "FG" : p.currency}</Text>
                </View>
              ))}
              {payments.length > 0 && (
                <View style={s.totBalance}>
                  <Text style={balance <= 0 ? s.totCleared : s.totBalanceLabel}>Solde dû</Text>
                  <Text style={balance <= 0 ? s.totCleared : s.totBalanceValue}>
                    {balance <= 0 ? "✓ Soldé" : fmtAmt(balance)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          {showFooterPhone && phone && <View style={s.footerItem}><Text style={s.footerText}>📞  {phone}</Text></View>}
          {showFooterPhone && phone && showFooterWebsite && website && <View style={s.footerDivider} />}
          {showFooterWebsite && website && <View style={s.footerItem}><Text style={s.footerText}>🌐  {website}</Text></View>}
          {showFooterWebsite && website && showFooterNif && nif && <View style={s.footerDivider} />}
          {showFooterNif && nif && <View style={s.footerItem}><Text style={[s.footerText, { fontSize: 7 }]}>NIF  {nif}</Text></View>}
          {showFooterEmail && email && (
            <>
              <View style={s.footerDivider} />
              <View style={s.footerItem}><Text style={s.footerText}>✉  {email}</Text></View>
            </>
          )}
        </View>
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
