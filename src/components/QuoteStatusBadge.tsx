"use client"

import { useTranslations } from "next-intl"
import { QUOTE_STATUS_KEY, QUOTE_STATUS_STYLE, isQuoteStatus } from "@/lib/quote-status"

/** Status badge of a quote: Brouillon, Confirmé, Facturé or Annulé (OBS-003) */
export default function QuoteStatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const t = useTranslations("devis")
  if (!isQuoteStatus(status)) {
    return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600" data-testid="quote-status" data-status={status}>{status}</span>
  }
  const s = QUOTE_STATUS_STYLE[status]
  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${pad} ${s.bg} ${s.text}`} data-testid="quote-status" data-status={status}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {t(QUOTE_STATUS_KEY[status])}
    </span>
  )
}
