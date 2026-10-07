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

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
  } catch { return iso }
}

interface BLLine {
  description: string
  quantity: number
  warehouse: string | null
}

interface BonLivraisonPdfProps {
  number: string
  status: string
  accountName: string | null
  createdAt: string | null
  deliveryDate: string | null
  notes: string | null
  lines: BLLine[]
  companyName?: string | null
  docSettings?: Record<string, unknown> | null
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: "En cours",  bg: "#fffbeb", text: "#b45309" },
  delivered: { label: "Livré",     bg: "#f0fdf4", text: "#15803d" },
  cancelled: { label: "Annulé",    bg: "#fef2f2", text: "#b91c1c" },
}

export async function renderBonLivraisonPdf(props: BonLivraisonPdfProps): Promise<Buffer> {
  const { number, status, accountName, createdAt, deliveryDate, notes, lines, docSettings: ds } = props

  const color    = (ds?.brand_color as string)    ?? "#1e3a5f"
  const companyName = (ds?.company_name as string) ?? "Global Energy Group SAS"
  const tagline  = (ds?.tagline as string)         ?? "Beyond Limits."
  const addr1    = (ds?.address_line1 as string)   ?? "Imm. Marbella"
  const city     = (ds?.city as string)            ?? "Lambanyii - Conakry"
  const phone    = (ds?.phone as string)           ?? "+224 613 04 40 20"
  const email    = (ds?.email as string)           ?? null
  const website  = (ds?.website as string)         ?? "www.globalenergygroup.com"
  const nif      = (ds?.nif as string)             ?? "446243099"
  const logoUrl  = (ds?.logo_url as string)        ?? null
  const cgvText  = (ds?.cgv_text as string)        ?? null

  const sc = statusConfig[status] ?? statusConfig.draft

  const s = StyleSheet.create({
    page:    { fontFamily: "Helvetica", fontSize: 9, color: "#111", backgroundColor: "#fff", padding: 0 },
    content: { flex: 1, paddingBottom: 40 },
    stripe:  { height: 4, backgroundColor: color },
    // Header
    header:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: "14 20 12 20", borderBottomWidth: 1, borderBottomColor: "#eee" },
    logo:     { height: 44, marginBottom: 6, objectFit: "contain" as const },
    coName:   { fontSize: 11, fontFamily: "Helvetica", fontWeight: "bold", color: "#111", marginBottom: 2 },
    coDetail: { fontSize: 8, color: "#777", lineHeight: 1.6 },
    tagline:  { fontSize: 18, fontFamily: "Helvetica", fontWeight: "bold", color, letterSpacing: -0.5 },
    // Title row
    titleRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: "14 20 0 20" },
    billToLabel: { fontSize: 7, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
    billToName:  { fontSize: 14, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    docInfo:     { alignItems: "flex-end" },
    docLabel:    { fontSize: 7, color: "#bbb", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 3 },
    docNumber:   { fontSize: 24, fontFamily: "Helvetica", fontWeight: "bold", color: "#111", letterSpacing: -1 },
    badge:       { marginTop: 5, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 10 },
    badgeText:   { fontSize: 8, fontFamily: "Helvetica", fontWeight: "bold" },
    // Meta bar
    metaBar:      { flexDirection: "row", margin: "10 20 0 20", borderWidth: 1, borderColor: "#eee", borderRadius: 6, overflow: "hidden", backgroundColor: "#fafafa" },
    metaCell:     { flex: 1, padding: "8 12", borderRightWidth: 1, borderRightColor: "#eee" },
    metaCellLast: { flex: 1, padding: "8 12" },
    metaLabel:    { fontSize: 7, color, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3, fontFamily: "Helvetica", fontWeight: "bold" },
    metaValue:    { fontSize: 9, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    // Table
    tableWrap:   { margin: "10 20 0 20" },
    tableHeader: { flexDirection: "row", backgroundColor: color, padding: "7 8" },
    thText:      { fontSize: 7.5, color: "#fff", textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Helvetica", fontWeight: "bold" },
    tableRow:     { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd", padding: "7 8", alignItems: "flex-start" },
    tableRowEven: { backgroundColor: "#f7f7f7" },
    tdDesc:  { fontSize: 8.5, fontFamily: "Helvetica", fontWeight: "bold", color: "#111" },
    tdNorm:  { fontSize: 8.5, color: "#444" },
    tdR:     { textAlign: "right" },
    // Notes
    notesBox:  { margin: "10 20 0 20", borderLeftWidth: 3, borderLeftColor: color, backgroundColor: color + "14", padding: "8 10", borderRadius: 4 },
    notesText: { fontSize: 8.5, color: "#555", lineHeight: 1.6 },
    // Signature zone
    sigZone:  { flexDirection: "row", justifyContent: "space-between", margin: "28 20 0 20", gap: 20 },
    sigBox:   { flex: 1, borderTopWidth: 1, borderTopColor: "#bbb", paddingTop: 6 },
    sigLabel: { fontSize: 8, color: "#777", textAlign: "center" },
    // Footer
    footer:      { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: color, flexDirection: "row", justifyContent: "center", alignItems: "center", padding: "9 20", flexWrap: "wrap", gap: 0 },
    footerItem:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12 },
    footerText:  { fontSize: 8, color: "#fff" },
    footerDiv:   { width: 1, height: 14, backgroundColor: "rgba(255,255,255,0.3)" },
  })

  const doc = (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.content}>

          {/* Top stripe */}
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
              <Text style={s.billToLabel}>Livré à</Text>
              <Text style={s.billToName}>{accountName ?? "—"}</Text>
            </View>
            <View style={s.docInfo}>
              <Text style={s.docLabel}>Bon de livraison</Text>
              <Text style={s.docNumber}>{number}</Text>
              <View style={[s.badge, { backgroundColor: sc.bg }]}>
                <Text style={[s.badgeText, { color: sc.text }]}>{sc.label}</Text>
              </View>
            </View>
          </View>

          {/* Meta bar */}
          <View style={s.metaBar}>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Date de création</Text>
              <Text style={s.metaValue}>{fmtDate(createdAt)}</Text>
            </View>
            {deliveryDate
              ? (
                <View style={s.metaCell}>
                  <Text style={s.metaLabel}>Date de livraison</Text>
                  <Text style={s.metaValue}>{fmtDate(deliveryDate)}</Text>
                </View>
              )
              : (
                <View style={s.metaCell}>
                  <Text style={s.metaLabel}>Date de livraison</Text>
                  <Text style={s.metaValue}>—</Text>
                </View>
              )
            }
            <View style={s.metaCellLast}>
              <Text style={s.metaLabel}>Statut</Text>
              <Text style={[s.metaValue, { color: sc.text }]}>{sc.label}</Text>
            </View>
          </View>

          {/* Lines table */}
          <View style={s.tableWrap}>
            <View style={s.tableHeader}>
              <Text style={[s.thText, { flex: 4 }]}>Description</Text>
              <Text style={[s.thText, { width: 50, textAlign: "right" }]}>Qté</Text>
              <Text style={[s.thText, { flex: 2, textAlign: "right" }]}>Entrepôt</Text>
            </View>
            {lines.map((l, i) => (
              <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowEven : {}]} wrap={false}>
                <Text style={[s.tdDesc, { flex: 4 }]}>{l.description}</Text>
                <Text style={[s.tdNorm, { width: 50 }, s.tdR]}>{l.quantity}</Text>
                <Text style={[s.tdNorm, { flex: 2 }, s.tdR]}>{l.warehouse ?? "—"}</Text>
              </View>
            ))}
          </View>

          {/* Notes */}
          {notes && (
            <View style={s.notesBox}>
              <Text style={s.notesText}>{notes}</Text>
            </View>
          )}

          {/* Signature zone */}
          <View style={s.sigZone} wrap={false}>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Signature du livreur</Text>
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Signature et cachet du destinataire</Text>
            </View>
          </View>

        {/* CGV */}
        {cgvText && (
          <View style={{ margin: "16 20 0 20", paddingTop: 14, borderTopWidth: 1, borderTopColor: "#eee" }} wrap={false}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica", fontWeight: "bold", color, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
              Conditions Générales de Vente
            </Text>
            <Text style={{ fontSize: 7, color: "#555", lineHeight: 1.6 }}>{cgvText}</Text>
          </View>
        )}

        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <View style={s.footerItem}><Text style={s.footerText}>📞  {phone}</Text></View>
          {website && <><View style={s.footerDiv} /><View style={s.footerItem}><Text style={s.footerText}>🌐  {website}</Text></View></>}
          {nif && <><View style={s.footerDiv} /><View style={s.footerItem}><Text style={[s.footerText, { fontSize: 7 }]}>NIF  {nif}</Text></View></>}
          {email && <><View style={s.footerDiv} /><View style={s.footerItem}><Text style={s.footerText}>✉  {email}</Text></View></>}
        </View>
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
