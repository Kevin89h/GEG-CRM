// Document numbers: next sequence = highest existing sequence + 1 (never "number of rows + 1", which collides as
// soon as a number is missing — a deleted draft, an imported document, a former numbering format).
// Each document type keeps its own convention (global sequence or per-month sequence, see the callers).

type Db = { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

const PAGE = 1000

/**
 * Highest sequence among the numbers of `table` starting with `prefix` and matching `pattern`
 * (the sequence is the first capture group), plus one. Reads every matching number, page by page.
 */
export async function nextSequence(db: Db, table: string, prefix: string, pattern: RegExp): Promise<number> {
  let max = 0
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select("number").like("number", `${prefix}%`).order("number").range(from, from + PAGE - 1)
    if (error) throw new Error(`Numérotation impossible (${table}) : ${error.message}`)
    for (const row of (data ?? []) as Array<{ number: string | null }>) {
      const m = pattern.exec(row.number ?? "")
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    if (!data || data.length < PAGE) break
  }
  return max + 1
}

const pad = (n: number, width: number) => String(n).padStart(width, "0")
const yearMonth = (d = new Date()) => ({ year: d.getFullYear(), month: pad(d.getMonth() + 1, 2) })

/** Quotes: DEV-YYYY-MM-NNNN, global sequence (same rule as the quote creation). */
export async function nextQuoteNumber(db: Db): Promise<string> {
  const { year, month } = yearMonth()
  return `DEV-${year}-${month}-${pad(await nextSequence(db, "sales_orders", "DEV-", /^DEV-\d{4}-\d{2}-(\d+)$/), 4)}`
}

/** Invoices: FAC-YYYY-MM-NNNN, global sequence; `date` gives the year / month (issue date). */
export async function nextInvoiceNumber(db: Db, date = new Date()): Promise<string> {
  const { year, month } = yearMonth(date)
  return `FAC-${year}-${month}-${pad(await nextSequence(db, "invoices", "FAC-", /^FAC-\d{4}-\d{2}-(\d+)$/), 4)}`
}

/** Credit notes: AVR-YYYY-MM-NNNN, global sequence. */
export async function nextCreditNoteNumber(db: Db): Promise<string> {
  const { year, month } = yearMonth()
  return `AVR-${year}-${month}-${pad(await nextSequence(db, "invoices", "AVR-", /^AVR-\d{4}-\d{2}-(\d+)$/), 4)}`
}

/** Supplier invoices: FF-YYYY-MM-NNNN, sequence per month (same rule as the supplier invoice creation). */
export async function nextSupplierInvoiceNumber(db: Db): Promise<string> {
  const { year, month } = yearMonth()
  const prefix = `FF-${year}-${month}-`
  return `${prefix}${pad(await nextSequence(db, "supplier_invoices", prefix, /^FF-\d{4}-\d{2}-(\d+)$/), 4)}`
}

/** Purchase receptions: BR/YYYY/NNNNN, global sequence. */
export async function nextReceptionNumber(db: Db): Promise<string> {
  return `BR/${new Date().getFullYear()}/${pad(await nextSequence(db, "purchase_receptions", "BR/", /^BR\/\d{4}\/(\d+)$/), 5)}`
}

// Both delivery note formats share ONE sequence (as before): BL/YYYY/NNNNN (from an invoice) and
// BL-YYYY-MM-NNNNN (partial delivery from a quote).
async function nextDeliverySequence(db: Db): Promise<number> {
  return Math.max(await nextSequence(db, "delivery_notes", "BL/", /^BL\/\d{4}\/(\d+)$/),
                  await nextSequence(db, "delivery_notes", "BL-", /^BL-\d{4}-\d{2}-(\d+)$/))
}

/** Delivery notes from an invoice: BL/YYYY/NNNNN. */
export async function nextDeliveryNoteNumber(db: Db): Promise<string> {
  return `BL/${new Date().getFullYear()}/${pad(await nextDeliverySequence(db), 5)}`
}

/** Partial delivery notes from a quote: BL-YYYY-MM-NNNNN. */
export async function nextPartialDeliveryNoteNumber(db: Db): Promise<string> {
  const { year, month } = yearMonth()
  return `BL-${year}-${month}-${pad(await nextDeliverySequence(db), 5)}`
}

/** Supplier credit notes: AFF-YYYY-MM-NNNN, global sequence. */
export async function nextSupplierCreditNoteNumber(db: Db): Promise<string> {
  const { year, month } = yearMonth()
  return `AFF-${year}-${month}-${pad(await nextSequence(db, "supplier_invoices", "AFF-", /^AFF-\d{4}-\d{2}-(\d+)$/), 4)}`
}

/** First free monthly sequence of supplier invoices (FF-YYYY-MM-), for imports that number several rows. */
export async function firstSupplierInvoiceSequence(db: Db): Promise<{ prefix: string; first: number }> {
  const { year, month } = yearMonth()
  const prefix = `FF-${year}-${month}-`
  return { prefix, first: await nextSequence(db, "supplier_invoices", prefix, /^FF-\d{4}-\d{2}-(\d+)$/) }
}
