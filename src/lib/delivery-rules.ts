// Targeted production fix R4 + ANO-001 (GEG, 18/11/2026) — same rules as the Dev version (tests-coline), adapted to
// the role model of production (admin / manager / sales_rep).
// R4: a delivery note cannot take out more than the stock of the chosen warehouse; only an ADMIN may override it,
//     with an explicit confirmation and a justification, traced on the stock move and on the delivery note. The real
//     resulting quantity is recorded (negative if needed), never silently set to 0.
// ANO-001: a line WITHOUT a catalogue sheet is never a service: it must be linked to its sheet before delivery.
//     Only a line linked to a SERVICE sheet (e.g. FRAIS DE TRANSPORT) never moves stock.

export type DeliveryLineKind = "product" | "service" | "unlinked"

export function deliveryLineKind(l: { product_id?: string | null; product_type?: string | null }): DeliveryLineKind {
  if (!l.product_id) return "unlinked"
  return l.product_type === "service" ? "service" : "product"
}

/** Words of a label, for suggestions: lower case, accents removed, "200L" → "200", "l" */
export function labelTokens(s: string): string[] {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/(\d)([a-z])/g, "$1 $2").split(/[^a-z0-9]+/).filter(t => t.length > 0)
}

/** Catalogue sheets closest to a free label (shared words, numbers weigh more); never applied automatically */
export function suggestProducts<P extends { id: string; name: string; reference?: string | null }>(label: string, products: P[], max = 5): P[] {
  const want = new Set(labelTokens(label))
  if (!want.size) return []
  return products.map(p => {
    const have = new Set([...labelTokens(p.name), ...labelTokens(p.reference ?? "")])
    let score = 0
    for (const t of want) if (have.has(t)) score += /\d/.test(t) ? 2 : 1
    return { p, score }
  }).filter(x => x.score >= 2).sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name)).slice(0, max).map(x => x.p)
}

export interface Shortage { product_id: string; product: string; warehouse_id: string; warehouse: string; requested: number; available: number; missing: number; result: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

/**
 * Stock check of the lines to deliver (product sheets read from the database by the caller).
 * Service sheets are left out; several lines of the same product and warehouse are added up.
 */
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

/** A derogation needs an explicit confirmation and a justification of at least 10 characters */
export function derogationReason(body: { derogation?: { reason?: string; confirmed?: boolean } } | null | undefined): string | null {
  const d = body?.derogation
  if (!d?.confirmed) return null
  const reason = (d.reason ?? "").trim()
  return reason.length >= 10 ? reason : null
}

/** Only an administrator may deliver beyond the available stock (production role model) */
export const canOverrideStock = (role: string | null | undefined) => role === "admin"
