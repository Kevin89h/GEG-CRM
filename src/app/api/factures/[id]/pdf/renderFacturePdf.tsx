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
  discount: number
  tva_rate: number | null
}

interface BankAccount {
  institution: string
  account_number: string
  swift: string | null
  iban: string | null
  currency: string
}

interface Props {
  number: string
  status: string
  currency: string
  issueDate: string
  dueDate: string | null
  notes: string | null
  accountName: string
  accountCity: string | null
  accountCountry: string | null
  accountPhone: string | null
  lines: Line[]
  payments: { amount: number; paid_at: string }[]
  qrDataUrl: string | null
  bankAccounts: BankAccount[]
  docSettings: Record<string, unknown> | null
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: "Brouillon",    bg: "#f3f4f6", text: "#6b7280" },
  sent:      { label: "Émise",        bg: "#eff6ff", text: "#1d4ed8" },
  partial:   { label: "Part. réglée", bg: "#fffbeb", text: "#b45309" },
  paid:      { label: "Payée",        bg: "#f0fdf4", text: "#15803d" },
  cancelled: { label: "Annulée",      bg: "#fef2f2", text: "#b91c1c" },
}

export async function renderFacturePdf(props: Props): Promise<Buffer> {
  const {
    number, status, currency, issueDate, dueDate, notes,
    accountName, accountCity, accountCountry, accountPhone,
    lines, payments, qrDataUrl, bankAccounts, docSettings: ds,
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
  const bankMeta = (ds?.bank_details as Record<string, string> | null) ?? {}

  const sc = statusConfig[status] ?? statusConfig.sent
  const cur = currency === "GNF" ? "FG" : currency

  const hasTva = lines.some(l => (l.tva_rate ?? 0) > 0)
  const defaultTva = hasTva ? 18 : 0

  const totalHT = lines.reduce((s, l) =>
    s + l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100), 0)

  const tvaByRate: Record<number, number> = {}
  for (const l of lines) {
    const rate = l.tva_rate != null ? l.tva_rate : defaultTva
    if (rate > 0) {
      const sub = l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100)
      tvaByRate[rate] = (tvaByRate[rate] ?? 0) + sub * rate / 100
    }
  }
  const totalTva = Object.values(tvaByRate).reduce((s, v) => s + v, 0)
  const totalTTC = totalHT + totalTva
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const balance = totalTTC - totalPaid

  const fmtAmt = (n: number) => `${fmt(Math.round(n))} ${cur}`
  const currencies = Array.from(new Set(bankAccounts.map(a => a.currency)))

  const s = StyleSheet.create({
    page: { fontFamily: "Helvetica", fontSize: 9, color: "#111", backgroundColor: "#fff", padding: 0 },
    content: { flex: 1, paddingBottom: 40 },
    stripe: { height: 4, backgroundColor: color },
    // Header
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: "14 20 12 20", borderBottomWidth: 1, borderBottomColor: "#eee" },
    logo: { height: 44, marginBottom: 6, objectFit: "contain" as const },
    coName: { fontSize: 11, fontFamily: "Helvetica", fontWeight: "bold", color: "#111", marginBottom: 2 },
    coDetail: { fontSize: 8, color: "#777", lineHeight: 1.6 },
    tagline: { fontSize: 18, fontFamily: "Helvetica", fontWeight: "bold", color, letterSpacing: -0.5 },
    // Title row
    titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: "14 20 0 20" },
    billToLabel: { fontSize: 7, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
    billToName: { fontSize: 14, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    billToDetail: { fontSize: 8, color: "#777", marginTop: 2 },
    docInfo: { alignItems: "flex-end" },
    docLabelText: { fontSize: 7, color: "#bbb", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 3 },
    docNumber: { fontSize: 24, fontFamily: "Helvetica", fontWeight: "bold", color: "#111", letterSpacing: -1 },
    badge: { marginTop: 5, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 10 },
    badgeText: { fontSize: 8, fontFamily: "Helvetica", fontWeight: "bold" },
    // Meta bar
    metaBar: { flexDirection: "row", margin: "10 20 0 20", borderWidth: 1, borderColor: "#eee", borderRadius: 6, overflow: "hidden", backgroundColor: "#fafafa" },
    metaCell: { flex: 1, padding: "8 12", borderRightWidth: 1, borderRightColor: "#eee" },
    metaCellLast: { flex: 1, padding: "8 12" },
    metaLabel: { fontSize: 7, color, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3, fontFamily: "Helvetica", fontWeight: "bold" },
    metaValue: { fontSize: 9, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    // Table
    tableWrap: { margin: "10 20 0 20" },
    tableHeader: { flexDirection: "row", backgroundColor: color, padding: "7 8" },
    thText: { fontSize: 7.5, color: "#fff", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Helvetica", fontWeight: "bold" },
    tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd", padding: "7 8", alignItems: "flex-start" },
    tableRowEven: { backgroundColor: "#f7f7f7" },
    tdDesc: { fontSize: 8.5, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    tdMuted: { fontSize: 7.5, color: "#aaa", marginTop: 1 },
    tdR: { textAlign: "right" },
    tdAmt: { fontSize: 8.5, fontFamily: "Helvetica", fontWeight: "bold", textAlign: "right" },
    // Notes
    notesBox: { margin: "10 20 0 20", borderLeftWidth: 3, borderLeftColor: color, backgroundColor: color + "14", padding: "8 10", borderRadius: 4 },
    notesText: { fontSize: 8.5, color: "#555", lineHeight: 1.6 },
    // Bottom
    bottomWrap: { flexDirection: "row", margin: "12 20 0 20", gap: 20 },
    bankSection: { flex: 1 },
    bankTitle: { fontSize: 7, fontFamily: "Helvetica", fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.8, color: "#888", marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#eee" },
    currencyGroup: { marginBottom: 6 },
    currencyBadge: { fontSize: 7, fontFamily: "Helvetica", fontWeight: "bold", color: "#fff", backgroundColor: color, paddingVertical: 1, paddingHorizontal: 6, borderRadius: 8, marginBottom: 4, alignSelf: "flex-start" },
    bankRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f0f0f0", paddingVertical: 2.5, gap: 8, alignItems: "center" },
    bankInst: { fontSize: 8, fontFamily: "Helvetica", fontWeight: "bold", color: "#111", width: 70 },
    bankNum: { fontSize: 8, color: "#111" },
    bankMeta: { fontSize: 7, color: "#aaa", flex: 1 },
    bankTvaKey: { fontSize: 7.5, color: "#aaa", marginTop: 6 },
    // Totals
    totalsBlock: { width: 230, flexShrink: 0 },
    payComm: { fontSize: 8, color: "#aaa", marginBottom: 8, lineHeight: 1.5 },
    payCommNum: { fontFamily: "Helvetica", fontWeight: "bold", color },
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
    // QR
    qrImage: { width: 60, height: 60, marginTop: 10, alignSelf: "flex-end" },
    // Footer
    footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: color, flexDirection: "row", justifyContent: "center", alignItems: "center", padding: "9 20", flexWrap: "wrap", gap: 0 },
    footerItem: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12 },
    footerText: { fontSize: 8, color: "#fff" },
    footerDivider: { width: 1, height: 14, backgroundColor: "rgba(255,255,255,0.3)" },
  })

  const doc = (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.content}>
        {/* Stripe */}
        <View style={s.stripe} />

        {/* Header */}
        <View style={s.header}>
          <View>
            {logoUrl
              ? <Image src={logoUrl} style={s.logo} />
              : <Text style={s.coName}>{companyName}</Text>
            }
            {logoUrl && <Text style={s.coName}>{companyName}</Text>}
            <Text style={s.coDetail}>{addr1}{"\n"}{city}</Text>
          </View>
          <Text style={s.tagline}>{tagline}</Text>
        </View>

        {/* Title row */}
        <View style={s.titleRow}>
          <View>
            <Text style={s.billToLabel}>Facturé à</Text>
            <Text style={s.billToName}>{accountName}</Text>
            {(accountCity || accountCountry) && (
              <Text style={s.billToDetail}>{[accountCity, accountCountry].filter(Boolean).join(", ")}</Text>
            )}
            {accountPhone && <Text style={s.billToDetail}>{accountPhone}</Text>}
          </View>
          <View style={s.docInfo}>
            <Text style={s.docLabelText}>Facture</Text>
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
            <Text style={s.metaValue}>{fmtDate(issueDate)}</Text>
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

        {/* Products table */}
        <View style={s.tableWrap}>
          <View style={s.tableHeader}>
            <Text style={[s.thText, { flex: 4 }]}>Description</Text>
            <Text style={[s.thText, { width: 50, textAlign: "right" }]}>Qté</Text>
            <Text style={[s.thText, { width: 80, textAlign: "right" }]}>Prix unit.</Text>
            {hasTva && <Text style={[s.thText, { width: 40, textAlign: "right" }]}>Taxes</Text>}
            <Text style={[s.thText, { width: 80, textAlign: "right" }]}>Montant</Text>
          </View>
          {lines.map((l, i) => {
            const disc = 1 - (l.discount ?? 0) / 100
            const sub = l.quantity * l.unit_price * disc
            const rate = l.tva_rate != null ? l.tva_rate : defaultTva
            return (
              <View key={l.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowEven : {}]} wrap={false}>
                <View style={{ flex: 4 }}>
                  <Text style={s.tdDesc}>{l.description}</Text>
                  {l.discount > 0 && <Text style={s.tdMuted}>Remise {l.discount}%</Text>}
                </View>
                <Text style={[{ width: 50, fontSize: 8.5, color: "#333" }, s.tdR]}>{fmt(l.quantity, 2)} U</Text>
                <Text style={[{ width: 80, fontSize: 8.5, color: "#333" }, s.tdR]}>{fmt(l.unit_price, 0)} {cur}</Text>
                {hasTva && (
                  <Text style={[{ width: 40, fontSize: 8, color: "#aaa" }, s.tdR]}>
                    {rate > 0 ? `TVA ${rate}%` : "—"}
                  </Text>
                )}
                <Text style={[{ width: 80 }, s.tdAmt]}>{fmt(sub, 0)} {cur}</Text>
              </View>
            )
          })}
        </View>

        {/* Notes */}
        {notes && (
          <View style={s.notesBox}>
            <Text style={s.notesText}>{notes}</Text>
          </View>
        )}

        {/* Bottom: bank accounts + totals */}
        <View style={s.bottomWrap} wrap={false}>
          {/* Bank accounts */}
          <View style={s.bankSection}>
            {bankAccounts.length > 0 && (
              <>
                <Text style={s.bankTitle}>Coordonnées bancaires</Text>
                {currencies.map(c => (
                  <View key={c} style={s.currencyGroup}>
                    <View style={s.currencyBadge}>
                      <Text style={{ fontSize: 7, color: "#fff" }}>{c}</Text>
                    </View>
                    {bankAccounts.filter(a => a.currency === c).map((acc, i) => (
                      <View key={i} style={s.bankRow} wrap={false}>
                        <Text style={s.bankInst}>{acc.institution}</Text>
                        <Text style={s.bankNum}>{acc.account_number}</Text>
                        {(acc.swift || acc.iban) && (
                          <Text style={s.bankMeta}>
                            {acc.swift ? `SWIFT: ${acc.swift}` : ""}
                            {acc.swift && acc.iban ? "  ·  " : ""}
                            {acc.iban ? `IBAN: ${acc.iban}` : ""}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
                {bankMeta.tva_key && (
                  <Text style={s.bankTvaKey}>Clé TVA : {bankMeta.tva_key}</Text>
                )}
              </>
            )}
            {qrDataUrl && <Image src={qrDataUrl} style={s.qrImage} />}
          </View>

          {/* Totals */}
          <View style={s.totalsBlock}>
            <Text style={s.payComm}>
              {"Communication de paiement :\n"}
              <Text style={s.payCommNum}>{number}</Text>
            </Text>

            {hasTva && (
              <View style={s.totRow}>
                <Text style={s.totLabel}>Montant hors taxes</Text>
                <Text style={s.totValue}>{fmtAmt(totalHT)}</Text>
              </View>
            )}
            {Object.entries(tvaByRate).map(([rate, amt]) => (
              <View key={rate} style={s.totRow}>
                <Text style={s.totLabel}>TVA {rate}%</Text>
                <Text style={s.totValue}>{fmtAmt(amt)}</Text>
              </View>
            ))}
            <View style={s.totTTC}>
              <Text style={s.totTTCText}>Total</Text>
              <Text style={s.totTTCText}>{fmtAmt(totalTTC)}</Text>
            </View>
            {payments.map((p, i) => (
              <View key={i} style={s.totPaid}>
                <Text style={s.totPaidLabel}>Versement {fmtDate(p.paid_at.slice(0, 10))}</Text>
                <Text style={s.totPaidValue}>− {fmtAmt(p.amount)}</Text>
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

        </View>{/* end content */}

        {/* Footer — fixed at bottom every page */}
        <View style={s.footer} fixed>
          {phone && <View style={s.footerItem}><Text style={s.footerText}>📞  {phone}</Text></View>}
          {phone && website && <View style={s.footerDivider} />}
          {website && <View style={s.footerItem}><Text style={s.footerText}>🌐  {website}</Text></View>}
          {website && nif && <View style={s.footerDivider} />}
          {nif && <View style={s.footerItem}><Text style={[s.footerText, { fontSize: 7 }]}>NIF  {nif}</Text></View>}
          {email && (
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
