// Delivery-note lines: product, service, comment — or NOT LINKED to the catalogue (regression of 17/11/2026,
// "GEG DIESIEL EXTRA 15W40 200L" shown as "prestation — pas de stock").
// GEG rules: a physical product stays a product, even with no stock; a missing stock never turns it into a service;
// every line must be linked to its catalogue sheet; availability checks and stock exits apply normally.
// => A line WITHOUT a catalogue sheet is never treated as a service: it must be linked (or explicitly linked to a
//    service sheet) before the delivery note can be validated. Only a line linked to a SERVICE sheet skips the stock.

export type DeliveryLineKind = "comment" | "product" | "service" | "unlinked"

export function deliveryLineKind(l: { line_type?: string | null; product_id?: string | null; product_type?: string | null }): DeliveryLineKind {
  if (l.line_type === "comment") return "comment"
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
  const scored = products.map(p => {
    const have = new Set([...labelTokens(p.name), ...labelTokens(p.reference ?? "")])
    let score = 0
    for (const t of want) if (have.has(t)) score += /\d/.test(t) ? 2 : 1
    return { p, score }
  }).filter(x => x.score >= 2).sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
  return scored.slice(0, max).map(x => x.p)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

/**
 * When a delivery note is created from a document with OLD free lines, uses the VALIDATED historical correspondence
 * (historical_line_links, decision 6 of 10/11/2026) to link the delivery line to its catalogue sheet.
 * Proposed (not validated) correspondences are never applied automatically. Returns the number of lines linked.
 */
export async function applyValidatedLinks(db: Db, deliveryNoteId: string, sourceTable: "invoice_lines" | "sales_order_lines", sourceDocId: string): Promise<number> {
  const fk = sourceTable === "invoice_lines" ? "invoice_id" : "order_id"
  const { data: dnLines } = await db.from("delivery_note_lines").select("id, description, line_type, product_id").eq("delivery_note_id", deliveryNoteId).is("product_id", null)
  const todo = ((dnLines ?? []) as { id: string; description: string; line_type: string | null }[]).filter(l => l.line_type !== "comment")
  if (!todo.length) return 0
  const { data: src } = await db.from(sourceTable).select("id, description").eq(fk, sourceDocId).is("product_id", null)
  const srcLines = (src ?? []) as { id: string; description: string }[]
  if (!srcLines.length) return 0
  const { data: links } = await db.from("historical_line_links").select("line_id, product_id").eq("line_table", sourceTable).eq("status", "validated").in("line_id", srcLines.map(s => s.id))
  const byLine = new Map(((links ?? []) as { line_id: string; product_id: string }[]).map(l => [l.line_id, l.product_id]))
  let n = 0
  for (const l of todo) {
    const s = srcLines.find(x => (x.description ?? "").trim() === (l.description ?? "").trim() && byLine.has(x.id))
    if (!s) continue
    const { error } = await db.from("delivery_note_lines").update({ product_id: byLine.get(s.id) }).eq("id", l.id).is("product_id", null)
    if (!error) n++
  }
  return n
}
