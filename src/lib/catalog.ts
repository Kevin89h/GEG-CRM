// Catalogue rules for sales lines and stock (REGLES_PRODUITS_STOCK_FACTURATION.md, decisions R1–R6 / H1–H4).
// Server only. The database enforces the same rules (trigger catalog_line_rules, document_rules).

type Db = { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

export const NOT_FOUND_MESSAGE =
  "Produit ou service introuvable dans le catalogue GEG.\n" +
  "Avant de poursuivre votre devis ou votre facture, vous devez créer la fiche correspondante.\n" +
  "Vérifiez d'abord les articles similaires proposés ci-dessous afin d'éviter les doublons.\n" +
  "Si aucun article ne correspond, créez une nouvelle fiche en sélectionnant correctement son type (marchandise ou service), " +
  "sa référence, sa désignation, son conditionnement et les autres caractéristiques nécessaires.\n" +
  "Une fois la fiche enregistrée, vous pourrez la sélectionner et poursuivre votre document."

// ---------------------------------------------------------------------------------------------
// R1 / R2: every new sales line is an active catalogue product
// ---------------------------------------------------------------------------------------------

export type SalesLineInput = {
  product_id?: string | null; description?: string | null; line_type?: string | null
  quantity?: number | string | null; unit_price?: number | string | null; discount?: number | string | null
}

/** True for a comment line (text only: no product, quantity, price nor amount) */
export const isComment = (l: { line_type?: string | null }) => l.line_type === "comment"

/**
 * Normalises a comment line before saving: no product, zero quantity / price / discount.
 * Returns null for a sales line (left untouched).
 */
export function commentFields(l: SalesLineInput & { print_on_pdf?: boolean | null }) {
  if (!isComment(l)) return null
  return { line_type: "comment", product_id: null, quantity: 0, unit_price: 0, discount: 0, print_on_pdf: l.print_on_pdf !== false, description: (l.description ?? "").trim() }
}

/**
 * Error message (French) when a line breaks the catalogue rules, null when all are valid:
 * sales lines must be ACTIVE catalogue products (R1, R2); comment lines carry text only;
 * a negative amount is accepted on a SERVICE line only (e.g. "Remise commerciale").
 */
export async function invalidSalesLines(db: Db, lines: SalesLineInput[]): Promise<string | null> {
  const comments = lines.map((l, i) => ({ l, i })).filter(x => isComment(x.l))
  const badComment = comments.find(x => !(x.l.description ?? "").trim() || x.l.product_id ||
    Number(x.l.quantity ?? 0) !== 0 || Number(x.l.unit_price ?? 0) !== 0 || Number(x.l.discount ?? 0) !== 0)
  if (badComment) {
    return `Ligne ${badComment.i + 1} : une ligne de commentaire contient seulement du texte (ni produit, ni quantité, ni prix, ni remise).`
  }
  const sales = lines.map((l, i) => ({ l, i })).filter(x => !isComment(x.l))
  const missing = sales.filter(x => !x.l.product_id)
  if (missing.length) {
    return `Ligne${missing.length > 1 ? "s" : ""} ${missing.map(x => x.i + 1).join(", ")} sans produit du catalogue` +
      ` (${missing.map(x => `« ${(x.l.description ?? "").trim() || "vide"} »`).join(", ")}). ` +
      "Chaque ligne doit être un produit ou un service du catalogue GEG (ou une ligne de commentaire)."
  }
  if (!sales.length) return null
  const ids = [...new Set(sales.map(x => x.l.product_id as string))]
  const { data } = await db.from("products").select("id, name, is_active, product_type").in("id", ids)
  const found = new Map<string, { name: string; is_active: boolean; product_type: string | null }>((data ?? []).map((p: { id: string; name: string; is_active: boolean; product_type: string | null }) => [p.id, p]))
  const unknown = ids.filter(id => !found.has(id))
  if (unknown.length) return "Produit introuvable dans le catalogue."
  const inactive = ids.map(id => found.get(id)!).filter(p => !p.is_active)
  if (inactive.length) return `Produit désactivé, il ne peut plus être vendu : ${inactive.map(p => p.name).join(", ")}.`
  const negative = sales.find(x => Number(x.l.unit_price ?? 0) < 0 && found.get(x.l.product_id as string)?.product_type !== "service")
  if (negative) {
    return `Ligne ${negative.i + 1} : un montant négatif n'est possible que sur un service (par exemple « Remise commerciale »), pas sur une marchandise.`
  }
  return null
}

// ---------------------------------------------------------------------------------------------
// Anti-duplicate search: compares designation, reference, brand/range tokens, viscosity, packaging
// ---------------------------------------------------------------------------------------------

export function normalize(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/(\d)\s*[- ]?\s*w\s*[- ]?\s*(\d)/g, "$1w$2")      // 15 W-40 → 15w40
    .replace(/(\d+(?:[.,]\d+)?)\s*(l|kg|ml|litres?)\b/g, (_, n, u) => `${n.replace(",", ".")}${u.startsWith("lit") ? "l" : u}`) // 20 L → 20l
    .replace(/[^a-z0-9.+/]+/g, " ").trim()
}

const STOP = new Set(["de", "du", "la", "le", "les", "et", "pour", "a", "en", "x"])

export function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(t => t.length > 1 && !STOP.has(t))
}

export function viscosity(s: string | null | undefined): string | null {
  return normalize(s).match(/\b\d{1,2}w\d{2,3}\b/)?.[0] ?? null
}

export function packaging(s: string | null | undefined): string | null {
  return normalize(s).match(/\b\d+(?:\.\d+)?(?:l|kg|ml)\b/)?.[0] ?? null
}

export interface CatalogItem {
  id: string; name: string; brand?: string | null; to_complete?: boolean; missing_info?: string | null; reference: string | null; product_code: string | null; merchant_reference: string | null
  product_type: string | null; is_active: boolean; category: string | null; unit: string | null; packagings: string[]
  sell_price: number | null; currency: string | null
}

// Brands and product ranges: a different brand, or a different range of the same brand, is a DISTINCT product
// (catalogue rule of 10/11/2026), even with identical dimensions, viscosity or packaging.
const BRANDS = ["geg", "total", "totalenergies", "shell", "fuchs", "petronas", "mobil", "castrol", "eurotec", "elf",
  "double road", "doubleroad", "triangle", "luxxan", "joyroad", "michelin", "bridgestone", "goodyear", "weichai", "toyota", "caterpillar"]
const RANGES = ["carter ep", "carter xep", "carter", "rubia", "rimula", "helix", "tellus", "omala", "spirax", "renolin", "titan",
  "reductor", "compressor", "diesel extra", "diesel premium", "extra", "premium", "atf", "gear", "hydraulic", "hydraulique", "antifreeze", "sf12+", "sf12"]

/** Brand found in the item's brand field or in its designation */
export function brandOf(text: string | null | undefined, field?: string | null): string | null {
  const b = normalize(field)
  if (b) return b.replace(/s+/g, " ")
  const n = ` ${normalize(text)} `
  const hit = BRANDS.find(x => n.includes(` ${x} `))
  return hit ? hit.replace("doubleroad", "double road").replace("totalenergies", "total") : null
}

/** Product range (most specific first), e.g. "carter xep" vs "carter ep" */
export function rangeOf(text: string | null | undefined): string | null {
  const n = ` ${normalize(text)} `
  return RANGES.find(x => n.includes(` ${x} `)) ?? null
}

export interface Candidate extends CatalogItem { score: number; reasons: string[] }

/** Similar catalogue items for a search text, best first, with the reasons that make them close or different */
export function similarItems(query: string, items: CatalogItem[], limit = 12): Candidate[] {
  const q = tokens(query)
  if (!q.length) return []
  const qVisc = viscosity(query), qPack = packaging(query)
  return items.map(it => {
    const text = [it.name, it.reference, it.product_code, it.merchant_reference].filter(Boolean).join(" ")
    const t = new Set(tokens(text))
    const common = q.filter(w => t.has(w) || [...t].some(x => x.length > 3 && w.length > 3 && (x.startsWith(w) || w.startsWith(x))))
    let score = common.length / q.length
    const reasons: string[] = []
    if (common.length) reasons.push(`mots communs : ${common.join(", ")}`)
    const qBrand = brandOf(query), iBrand = brandOf(it.name, it.brand)
    if (qBrand && iBrand) {
      if (qBrand === iBrand) { score += 0.1; reasons.push(`même marque ${iBrand.toUpperCase()}`) }
      else { score -= 0.3; reasons.push(`marque différente (${iBrand.toUpperCase()}) : article distinct`) }
    }
    const qRange = rangeOf(query), iRange = rangeOf(text)
    if (qRange && iRange && qRange !== iRange) { score -= 0.2; reasons.push(`gamme différente (${iRange.toUpperCase()}) : article distinct`) }
    const v = viscosity(text)
    if (qVisc && v) { if (qVisc === v) { score += 0.3; reasons.push(`même viscosité ${v.toUpperCase()}`) } else { score -= 0.3; reasons.push(`viscosité différente (${v.toUpperCase()})`) } }
    const itemPacks = [packaging(text), ...it.packagings.map(p => packaging(p)), packaging(it.unit)].filter(Boolean) as string[]
    if (qPack && itemPacks.length) {
      if (itemPacks.includes(qPack)) { score += 0.2; reasons.push(`même conditionnement ${qPack.toUpperCase()}`) }
      else reasons.push(`conditionnement différent (${[...new Set(itemPacks)].map(p => p.toUpperCase()).join(", ")}) : article distinct`)
    }
    if (!it.is_active) reasons.push("désactivé : non sélectionnable")
    if (it.is_active && it.to_complete) reasons.push("fiche à compléter")
    return { ...it, score: Math.round(score * 100) / 100, reasons }
  }).filter(c => c.score >= 0.34).sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Catalogue items with the fields useful to compare them (no purchase price nor internal data) */
export async function loadCatalog(db: Db): Promise<CatalogItem[]> {
  const { data } = await db.from("products")
    .select("id, name, brand, to_complete, missing_info, reference, product_code, merchant_reference, product_type, is_active, sell_price, currency, category:product_categories(name), unit:units(name), packaging:product_packaging(unit:units(name))")
    .order("name")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((p: any) => ({
    id: p.id, name: p.name, brand: p.brand ?? null, to_complete: !!p.to_complete, missing_info: p.missing_info ?? null, reference: p.reference, product_code: p.product_code, merchant_reference: p.merchant_reference,
    product_type: p.product_type, is_active: p.is_active, sell_price: p.sell_price, currency: p.currency,
    category: (Array.isArray(p.category) ? p.category[0] : p.category)?.name ?? null,
    unit: (Array.isArray(p.unit) ? p.unit[0] : p.unit)?.name ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    packagings: (p.packaging ?? []).map((k: any) => (Array.isArray(k.unit) ? k.unit[0] : k.unit)?.name).filter(Boolean),
  }))
}

// ---------------------------------------------------------------------------------------------
// Stock: availability (R3 alerts) and delivery check (R4), services never tracked (R5)
// ---------------------------------------------------------------------------------------------

export interface Shortage { product_id: string; product: string; warehouse_id: string; warehouse: string; requested: number; available: number; missing: number; result: number }

/** Lines that exceed the stock of their warehouse; service products are ignored (R5) */
export async function deliveryShortages(db: Db, lines: { product_id: string | null; warehouse_id: string | null; quantity: number }[]): Promise<{ shortages: Shortage[]; stockLines: typeof lines }> {
  const withProduct = lines.filter(l => l.product_id && l.warehouse_id && Number(l.quantity) > 0)
  if (!withProduct.length) return { shortages: [], stockLines: [] }
  const ids = [...new Set(withProduct.map(l => l.product_id as string))]
  const whs = [...new Set(withProduct.map(l => l.warehouse_id as string))]
  const [{ data: products }, { data: levels }, { data: warehouses }] = await Promise.all([
    db.from("products").select("id, name, product_type").in("id", ids),
    db.from("stock_levels").select("product_id, warehouse_id, quantity").in("product_id", ids).in("warehouse_id", whs),
    db.from("warehouses").select("id, name").in("id", whs),
  ])
  const prod = new Map<string, { name: string; product_type: string | null }>((products ?? []).map((p: { id: string; name: string; product_type: string | null }) => [p.id, p]))
  const stockLines = withProduct.filter(l => prod.get(l.product_id as string)?.product_type !== "service")
  // Several lines of the same product and warehouse are added up before comparing
  const need = new Map<string, number>()
  for (const l of stockLines) need.set(`${l.product_id}|${l.warehouse_id}`, (need.get(`${l.product_id}|${l.warehouse_id}`) ?? 0) + Number(l.quantity))
  const shortages: Shortage[] = []
  for (const [key, requested] of need) {
    const [pid, wid] = key.split("|")
    const available = Number((levels ?? []).find((x: { product_id: string; warehouse_id: string }) => x.product_id === pid && x.warehouse_id === wid)?.quantity ?? 0)
    if (requested > available) shortages.push({
      product_id: pid, product: prod.get(pid)?.name ?? pid, warehouse_id: wid,
      warehouse: (warehouses ?? []).find((w: { id: string }) => w.id === wid)?.name ?? wid,
      requested, available, missing: requested - available, result: available - requested,
    })
  }
  return { shortages, stockLines }
}

/** Validates a derogation request: explicit confirmation and a justification of at least 10 characters */
export function derogationReason(body: { derogation?: { reason?: string; confirmed?: boolean } } | null | undefined): string | null {
  const d = body?.derogation
  if (!d?.confirmed) return null
  const reason = (d.reason ?? "").trim()
  return reason.length >= 10 ? reason : null
}
