// Quote (sales order) statuses — OBS-003, GEG option B (18/11/2026).
// Single source for the label key and the colours, shared by the quote list, the quote page, the account,
// deal and sales screens and the exports. Technical statuses and stored data are unchanged.

export const QUOTE_STATUSES = ["draft", "confirmed", "invoiced", "cancelled"] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

/** Translation key of each status in the "devis" namespace: Brouillon, Confirmé, Facturé, Annulé */
export const QUOTE_STATUS_KEY: Record<QuoteStatus, "statusDraft" | "statusConfirmed" | "statusInvoiced" | "statusCancelled"> = {
  draft: "statusDraft",
  confirmed: "statusConfirmed",
  invoiced: "statusInvoiced",
  cancelled: "statusCancelled",
}

/** Badge colours (same as the quote list): grey, green, purple, red */
export const QUOTE_STATUS_STYLE: Record<QuoteStatus, { bg: string; text: string; dot: string }> = {
  draft:     { bg: "bg-gray-100",  text: "text-gray-700",   dot: "bg-gray-400" },
  confirmed: { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
  invoiced:  { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  cancelled: { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-400" },
}

export function isQuoteStatus(s: unknown): s is QuoteStatus {
  return typeof s === "string" && (QUOTE_STATUSES as readonly string[]).includes(s)
}
