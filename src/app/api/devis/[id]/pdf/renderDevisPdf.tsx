import React from "react"
import {
  Document, Page, View, Text, Image, StyleSheet, Font, renderToBuffer,
} from "@react-pdf/renderer"

// Use built-in fonts — no external fetch needed on Vercel
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

function fmtDate(iso: string | null, locale = "fr"): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short", year: "numeric" })
  } catch { return iso }
}

interface Line {
  id: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  tva_rate: number
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
  createdAt: string
  validUntil: string | null
  notes: string | null
  additionalInfo: string | null
  paymentTerms: string | null
  accountName: string
  accountCountry: string | null
  salespersonName: string | null
  lines: Line[]
  bankAccounts: BankAccount[]
  docSettings: Record<string, unknown> | null
}

export async function renderDevisPdf(props: Props): Promise<Buffer> {
  const {
    number, status, currency, createdAt, validUntil, notes, additionalInfo, paymentTerms,
    accountName, accountCountry, salespersonName, lines, bankAccounts, docSettings: ds,
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

  const docLabel = status === "confirmed" ? "BON DE COMMANDE" : "DEVIS"
  const cur = currency === "GNF" ? "FG" : currency

  const hasTva = lines.some(l => l.tva_rate > 0)
  const totalHT = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - l.discount / 100), 0)
  const tvaAmt = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - l.discount / 100) * l.tva_rate / 100, 0)
  const totalTTC = totalHT + tvaAmt

  const currencies = Array.from(new Set(bankAccounts.map(a => a.currency)))

  const s = StyleSheet.create({
    page: { fontFamily: "Helvetica", fontSize: 9, color: "#111", backgroundColor: "#fff", paddingBottom: 50 },
    // Header
    stripe: { height: 4, backgroundColor: color },
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
    docBadge: { marginTop: 5, paddingVertical: 3, paddingHorizontal: 10, backgroundColor: color + "22", borderRadius: 10 },
    docBadgeText: { fontSize: 8, fontFamily: "Helvetica", fontWeight: "bold", color },
    // Meta bar
    metaBar: { flexDirection: "row", margin: "10 20 0 20", borderWidth: 1, borderColor: "#eee", borderRadius: 6, overflow: "hidden", backgroundColor: "#fafafa" },
    metaCell: { flex: 1, padding: "8 12", borderRightWidth: 1, borderRightColor: "#eee" },
    metaCellLast: { flex: 1, padding: "8 12" },
    metaLabel: { fontSize: 7, color, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3, fontFamily: "Helvetica", fontWeight: "bold" },
    metaValue: { fontSize: 9, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    // Products table
    tableWrap: { margin: "10 20 0 20" },
    tableHeader: { flexDirection: "row", backgroundColor: color, padding: "7 8" },
    thText: { fontSize: 7.5, color: "#fff", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Helvetica", fontWeight: "bold" },
    tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd", padding: "7 8", alignItems: "flex-start" },
    tableRowEven: { backgroundColor: "#f7f7f7" },
    tdDesc: { fontSize: 8.5, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    tdMuted: { fontSize: 7.5, color: "#aaa", marginTop: 1 },
    tdR: { textAlign: "right" },
    tdAmt: { fontSize: 8.5, fontFamily: "Helvetica", fontWeight: "bold", textAlign: "right" },
    // Totals
    totalsWrap: { flexDirection: "row", justifyContent: "flex-end", padding: "8 20 0 20" },
    totalsInner: { width: 220 },
    totRow: { flexDirection: "row", justifyContent: "space-between", padding: "3 6", color: "#555" },
    totTTC: { flexDirection: "row", justifyContent: "space-between", padding: "5 6", borderTopWidth: 2, borderTopColor: color, marginTop: 2 },
    totTTCText: { fontSize: 11, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    // Notes
    notesBox: { margin: "10 20 0 20", borderLeftWidth: 3, borderLeftColor: color, backgroundColor: color + "14", padding: "8 10", borderRadius: 4 },
    notesText: { fontSize: 8.5, color: "#555", lineHeight: 1.6 },
    // Bank
    bottomWrap: { flexDirection: "row", margin: "12 20 0 20", gap: 20 },
    bankSection: { flex: 1 },
    bankTitle: { fontSize: 7, fontFamily: "Helvetica", fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.8, color: "#888", marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#eee" },
    currencyGroup: { marginBottom: 6 },
    currencyBadge: { fontSize: 7, fontFamily: "Helvetica", fontWeight: "bold", color: "#fff", backgroundColor: color, paddingVertical: 1, paddingHorizontal: 6, borderRadius: 8, marginBottom: 4, alignSelf: "flex-start" },
    bankRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f0f0f0", paddingVertical: 2.5, gap: 8, alignItems: "center" },
    bankInst: { fontSize: 8, fontFamily: "Helvetica", fontWeight: "bold", color: "#111", width: 70 },
    bankNum: { fontSize: 8, color: "#111" },
    bankMeta: { fontSize: 7, color: "#aaa", flex: 1 },
    // Conditions
    condBlock: { width: 160 },
    condTitle: { fontSize: 7, fontFamily: "Helvetica", fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.8, color: "#888", marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#eee" },
    condItem: { fontSize: 8, color: "#555", marginBottom: 3, lineHeight: 1.5 },
    condLabel: { fontFamily: "Helvetica", fontWeight: "bold", color: "#333" },
    // Footer
    footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: color, flexDirection: "row", justifyContent: "center", alignItems: "center", padding: "9 20", flexWrap: "wrap", gap: 0 },
    footerItem: { flexDirection: "row", alignItems: "center", gap: 4, color: "rgba(255,255,255,0.9)", paddingHorizontal: 12 },
    footerText: { fontSize: 8, color: "#fff" },
    footerDivider: { width: 1, height: 14, backgroundColor: "rgba(255,255,255,0.3)" },
  })

  const doc = (
    <Document>
      <Page size="A4" style={s.page}>
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
            <Text style={s.billToLabel}>Adressé à</Text>
            <Text style={s.billToName}>{accountName}</Text>
            {accountCountry && <Text style={s.billToDetail}>{accountCountry}</Text>}
          </View>
          <View style={s.docInfo}>
            <Text style={s.docLabelText}>{docLabel}</Text>
            <Text style={s.docNumber}>{number}</Text>
            <View style={s.docBadge}><Text style={s.docBadgeText}>{docLabel}</Text></View>
          </View>
        </View>

        {/* Meta bar */}
        <View style={s.metaBar}>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Date</Text>
            <Text style={s.metaValue}>{fmtDate(createdAt)}</Text>
          </View>
          {validUntil && (
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Valide jusqu&apos;au</Text>
              <Text style={s.metaValue}>{fmtDate(validUntil)}</Text>
            </View>
          )}
          {salespersonName && (
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Vendeur</Text>
              <Text style={s.metaValue}>{salespersonName}</Text>
            </View>
          )}
          <View style={s.metaCellLast}>
            <Text style={s.metaLabel}>Devise</Text>
            <Text style={s.metaValue}>{currency}</Text>
          </View>
        </View>

        {/* Products table */}
        <View style={s.tableWrap}>
          {/* Header */}
          <View style={s.tableHeader}>
            <Text style={[s.thText, { flex: 4 }]}>Description</Text>
            <Text style={[s.thText, { width: 50, textAlign: "right" }]}>Qté</Text>
            <Text style={[s.thText, { width: 80, textAlign: "right" }]}>Prix unit.</Text>
            {hasTva && <Text style={[s.thText, { width: 40, textAlign: "right" }]}>TVA</Text>}
            <Text style={[s.thText, { width: 80, textAlign: "right" }]}>Montant</Text>
          </View>
          {/* Rows */}
          {lines.map((l, i) => {
            const sub = l.quantity * l.unit_price * (1 - l.discount / 100)
            return (
              <View key={l.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowEven : {}]} wrap={false}>
                <View style={{ flex: 4 }}>
                  <Text style={s.tdDesc}>{l.description}</Text>
                  {l.discount > 0 && <Text style={s.tdMuted}>Remise {l.discount}%</Text>}
                </View>
                <Text style={[{ width: 50, fontSize: 8.5, color: "#333" }, s.tdR]}>{fmt(l.quantity, 2)} U</Text>
                <Text style={[{ width: 80, fontSize: 8.5, color: "#333" }, s.tdR]}>{fmt(l.unit_price, 0)} {cur}</Text>
                {hasTva && <Text style={[{ width: 40, fontSize: 8, color: "#aaa" }, s.tdR]}>{l.tva_rate > 0 ? `${l.tva_rate}%` : "—"}</Text>}
                <Text style={[{ width: 80 }, s.tdAmt]}>{fmt(sub, 0)} {cur}</Text>
              </View>
            )
          })}
        </View>

        {/* Totals */}
        <View style={s.totalsWrap}>
          <View style={s.totalsInner}>
            <View style={s.totRow}>
              <Text>Montant hors taxes</Text>
              <Text>{fmt(totalHT, 0)} {cur}</Text>
            </View>
            {hasTva && (
              <View style={s.totRow}>
                <Text>TVA 18%</Text>
                <Text>{fmt(tvaAmt, 0)} {cur}</Text>
              </View>
            )}
            <View style={s.totTTC}>
              <Text style={s.totTTCText}>Total</Text>
              <Text style={s.totTTCText}>{fmt(totalTTC, 0)} {cur}</Text>
            </View>
          </View>
        </View>

        {/* Informations supplémentaires */}
        {additionalInfo && (
          <View style={s.notesBox}>
            <Text style={{ fontSize: 7.5, fontWeight: 700, color: "#666", textTransform: "uppercase", marginBottom: 3 }}>Informations supplémentaires</Text>
            <Text style={s.notesText}>{additionalInfo}</Text>
          </View>
        )}

        {/* Bank accounts + conditions */}
        <View style={s.bottomWrap} wrap={false}>
          {bankAccounts.length > 0 && (
            <View style={s.bankSection}>
              <Text style={s.bankTitle}>Coordonnées bancaires</Text>
              {currencies.map(c => (
                <View key={c} style={s.currencyGroup}>
                  <View style={s.currencyBadge}><Text style={{ fontSize: 7, color: "#fff" }}>{c}</Text></View>
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
            </View>
          )}
          {paymentTerms && (
            <View style={s.condBlock}>
              <Text style={s.condTitle}>Conditions</Text>
              <Text style={s.condItem}><Text style={s.condLabel}>Paiement : </Text>{paymentTerms}</Text>
            </View>
          )}
        </View>

        {/* Footer — absolute, always at bottom */}
        <View style={s.footer} fixed>
          {phone && <View style={s.footerItem}><Text style={s.footerText}>📞  {phone}</Text></View>}
          {phone && website && <View style={s.footerDivider} />}
          {website && <View style={s.footerItem}><Text style={s.footerText}>🌐  {website}</Text></View>}
          {website && nif && <View style={s.footerDivider} />}
          {nif && <View style={s.footerItem}><Text style={[s.footerText, { fontSize: 7 }]}>NIF  {nif}</Text></View>}
          {email && <><View style={s.footerDivider} /><View style={s.footerItem}><Text style={s.footerText}>✉  {email}</Text></View></>}
        </View>
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
