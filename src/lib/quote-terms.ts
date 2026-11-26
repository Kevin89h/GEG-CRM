// Commercial conditions printed on a quote (REG-09, GEG 26/11/2026). Shared by the print page, the downloaded PDF and
// the quote screen, so that the conditions entered in the CRM are exactly those printed.
// - « Terms & Conditions » : 5 structured fields; when NOTHING was entered, the usual defaults are printed (as before);
// - « Conditions générales » : free text of the quote (pre-filled with the client's general conditions), now printed.
export type QuoteTerms = { prices?: string; payment_terms?: string; validity?: string; lead_time?: string; delivery_location?: string }

export const DEFAULT_TC: Required<QuoteTerms> = {
  prices: "USD",
  payment_terms: "100% before delivery",
  validity: "7 days",
  lead_time: "5–7 days",
  delivery_location: "To be discussed",
}

export const TC_FIELDS: { key: keyof QuoteTerms; label: string }[] = [
  { key: "prices", label: "Prices" },
  { key: "payment_terms", label: "Payment Terms" },
  { key: "validity", label: "Quotation Validity" },
  { key: "lead_time", label: "Delivery Lead Time" },
  { key: "delivery_location", label: "Delivery Location" },
]

/** Terms to print: those entered on the quote, or the defaults when none was entered */
export function effectiveTerms(tc: QuoteTerms | null | undefined): QuoteTerms {
  const entered = tc && TC_FIELDS.some(f => String(tc[f.key] ?? "").trim())
  return entered ? tc! : DEFAULT_TC
}

/** Printed rows (label, value), empty values left out */
export function termRows(tc: QuoteTerms | null | undefined): { label: string; value: string }[] {
  const t = effectiveTerms(tc)
  return TC_FIELDS.map(f => ({ label: f.label, value: String(t[f.key] ?? "").trim() })).filter(r => r.value)
}
