// Document exchange rates (geg_*.exchange_rates) — helpers shared by server and browser code (D-07 / D-08, GEG 16/11/2026).
// These are REFERENCE rates proposed for NEW operations (purchase GNF equivalent, supplier / customer payments in another
// currency). The rate actually applied is stored with each payment and is never recalculated afterwards.

export interface DocRate {
  from_currency: string
  to_currency: string
  rate: number | string
  effective_date: string
  notes?: string | null
  created_at?: string | null
}

/** Pairs refreshed from the provider (unchanged list) */
export const DOC_PAIRS: ReadonlyArray<{ from: string; to: string }> = [
  { from: "USD", to: "GNF" },
  { from: "EUR", to: "GNF" },
  { from: "XOF", to: "GNF" },
  { from: "EUR", to: "USD" },
  { from: "USD", to: "EUR" },
  { from: "XOF", to: "USD" },
  { from: "XOF", to: "EUR" },
]

/**
 * Pairs refreshed for each company (D-10, GEG 17/11/2026), from the currencies each one really uses:
 * GEG Guinée: GNF, USD, EUR, XOF — GEG Singapour: EUR (invoices, treasury) and USD (deals). Each company keeps its
 * own rates in its own schema; nothing is shared between them.
 */
export const DOC_PAIRS_BY_SCHEMA: Readonly<Record<string, ReadonlyArray<{ from: string; to: string }>>> = {
  geg_guinee: DOC_PAIRS,
  geg_singapore: [
    { from: "USD", to: "EUR" },
    { from: "EUR", to: "USD" },
  ],
}
export function docPairsFor(schema: string | null | undefined): ReadonlyArray<{ from: string; to: string }> {
  return DOC_PAIRS_BY_SCHEMA[schema ?? ""] ?? DOC_PAIRS
}

/** Reference rates older than this are flagged with a visible alert */
export const DOC_RATES_STALE_DAYS = 2

const byLatest = (a: DocRate, b: DocRate) =>
  b.effective_date.localeCompare(a.effective_date) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))

/**
 * Latest reference rate for 1 `from` = ? `to`, trying the stored pair then its inverse (1 / rate).
 * Returns the rate with its date and origin, or null when no rate exists.
 */
export function bestDocRate(rates: DocRate[], from: string, to: string): { rate: number; date: string; notes: string | null; inverse: boolean } | null {
  if (!from || !to || from === to) return null
  const direct = rates.filter(r => r.from_currency === from && r.to_currency === to && Number(r.rate) > 0).sort(byLatest)[0]
  if (direct) return { rate: Number(direct.rate), date: direct.effective_date, notes: direct.notes ?? null, inverse: false }
  const inv = rates.filter(r => r.from_currency === to && r.to_currency === from && Number(r.rate) > 0).sort(byLatest)[0]
  if (inv) return { rate: 1 / Number(inv.rate), date: inv.effective_date, notes: inv.notes ?? null, inverse: true }
  return null
}

/** Decimals of an amount in a currency: none for GNF / XOF, 2 otherwise */
export function currencyDecimals(currency: string): number {
  return ["GNF", "XOF", "XAF", "JPY"].includes(currency) ? 0 : 2
}

/** Rounds an amount to the decimals of its currency (never to the unit for EUR / USD) */
export function roundAmount(value: number, currency: string): number {
  const f = 10 ** currencyDecimals(currency)
  return Math.round(value * f) / f
}

/** Fixed parity (D-06): 1 EUR = 655.957 XOF, also used for the XOF → EUR reference rate of the documents */
export const XOF_PER_EUR = 655.957

type PaymentLike = { amount: number | string; currency?: string | null; exchange_rate?: number | string | null }

/**
 * Total paid in the invoice currency, balance and status of a supplier invoice.
 * A payment in another currency is converted with ITS OWN recorded rate (never recalculated). Because that payment is
 * rounded to the cent (or unit) of its currency, a remainder smaller than that rounding converted into the invoice
 * currency is not a real debt: the invoice is then settled (D-07, e.g. 1 524,49 € for 1 000 000 XOF leaves 0,33 XOF).
 */
export function supplierSettlement(totalTtc: number, payments: PaymentLike[], invoiceCurrency: string): { totalPaid: number; balance: number; status: "paid" | "partial" | "pending" } {
  let totalPaid = 0, tolerance = 0
  for (const p of payments) {
    const amt = Number(p.amount)
    const rate = Number(p.exchange_rate)
    if (p.currency && p.currency !== invoiceCurrency && rate > 0) {
      totalPaid += amt / rate
      tolerance = Math.max(tolerance, (0.5 / 10 ** currencyDecimals(p.currency)) / rate)
    } else totalPaid += amt
  }
  const balance = Number(totalTtc) - totalPaid
  // same thresholds as the database (supplier_invoice_totals, delete_payment_safe — D-09 / D-12): 0.005 for a
  // same-currency payment, widened only by the rounding of a foreign-currency one
  const status = balance <= Math.max(tolerance, 0.005) + 1e-9 ? "paid" : totalPaid > 0 ? "partial" : "pending"
  return { totalPaid, balance: status === "paid" && balance > 0 ? 0 : balance, status }
}

/** Rate kept with 10 significant digits (enough for 0.001524490 as for 10 137.18891), as a plain string for inputs */
export function rateToInput(rate: number): string {
  if (!(rate > 0)) return ""
  return String(Number(rate.toPrecision(10)))
}

/** Rate for display, French format, with enough decimals for low-value currencies */
export function formatRate(rate: number | string): string {
  const r = Number(rate)
  if (!(r > 0)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumSignificantDigits: 10 }).format(Number(r.toPrecision(10)))
}

/** Whole days between a yyyy-mm-dd date and today (UTC) */
export function ageInDays(date: string, now: Date = new Date()): number {
  const d = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((t - d) / 86400000)
}

/** Source of a stored rate, read from its notes ("… via open.er-api.com", "Actualisation automatique — …", or manual entry) */
export function rateOrigin(notes: string | null | undefined): string {
  const n = (notes ?? "").trim()
  // the former button wrote "Mis à jour automatiquement via open.er-api.com": that was a MANUAL refresh
  if (/quotidienne/i.test(n)) return "actualisation automatique — open.er-api.com"
  if (/open\.er-api/i.test(n)) return "actualisation manuelle — open.er-api.com"
  return n ? `saisie manuelle (${n})` : "saisie manuelle"
}
