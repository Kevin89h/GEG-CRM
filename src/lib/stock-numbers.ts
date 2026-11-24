// Document numbers, exactly as production numbers them today (count + 1). Kept unchanged by the targeted stock
// deployment: the numbering rework (N1) belongs to the general deployment.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

const pad = (n: number, w: number) => String(n).padStart(w, "0")
async function count(db: Db, table: string): Promise<number> {
  const { count: c } = await db.from(table).select("id", { count: "exact", head: true })
  return c ?? 0
}

/** Delivery note created from an invoice: BL/YYYY/NNNNN */
export async function invoiceDeliveryNoteNumber(db: Db): Promise<string> {
  return `BL/${new Date().getFullYear()}/${pad((await count(db, "delivery_notes")) + 1, 5)}`
}

/** Partial delivery note created from a quote: BL-YYYY-MM-NNNNN */
export async function quoteDeliveryNoteNumber(db: Db): Promise<string> {
  const d = new Date()
  return `BL-${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad((await count(db, "delivery_notes")) + 1, 5)}`
}

/** Purchase reception: BR/YYYY/NNNNN */
export async function receptionNumber(db: Db): Promise<string> {
  return `BR/${new Date().getFullYear()}/${pad((await count(db, "purchase_receptions")) + 1, 5)}`
}
