"use client"
// Multi-currency summaries (G1, OBS-001 / D-01 to D-03): one line per currency (code on the left, amount aligned on
// the right), never added together, plus an indicative total in EUR computed with the latest market rates, set apart
// below a dashed line, with the date and source of the rates one click away. Pure presentation: amounts, currencies
// and calculations are those given by the caller. Individual document amounts keep their own formatting.
import { useState } from "react"

export interface FxInfo {
  /** units of each currency for 1 EUR */
  perEur: Record<string, number>
  date: string | null
  source: string
  stale: boolean
  /** fixed parities (D-06: XOF), independent of the rate provider */
  fixed?: Record<string, number>
}

export function eurTotal(byCurrency: Record<string, number>, fx: FxInfo): { eur: number | null; missing: string[] } {
  const missing = Object.keys(byCurrency).filter(c => byCurrency[c] !== 0 && !fx.perEur[c])
  return { eur: missing.length ? null : Object.entries(byCurrency).reduce((s, [c, v]) => s + v / fx.perEur[c], 0), missing }
}

export function fxDate(fx: FxInfo, short = false): string {
  if (!fx.date) return ""
  return new Date(fx.date + "T00:00:00Z").toLocaleDateString("fr-FR", short ? { timeZone: "UTC", day: "2-digit", month: "2-digit" } : { timeZone: "UTC" })
}

/** Label of a currency in the summaries (D-03): the CFA franc reads "F CFA (XOF)"; the stored code stays XOF */
export function currencyLabel(code: string): string {
  return code === "XOF" ? "F CFA (XOF)" : code
}

const NO_DECIMALS = new Set(["GNF", "XOF", "XAF", "JPY"])

/** Amount without currency symbol (the code is shown beside it): spaces between thousands, no decimals for GNF / F CFA */
export function formatSummaryAmount(value: number, code: string): string {
  const d = NO_DECIMALS.has(code) ? 0 : 2
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(value)
}

/** Indicative EUR total: whole euros from 100 € (it is an order of magnitude), cents below */
export function formatEurTotal(eur: number): string {
  const d = Math.abs(eur) >= 100 ? 0 : 2
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(eur) + " €"
}

const isFixed = (code: string, fx: FxInfo) => !!fx.fixed?.[code]

function rateLine(code: string, fx: FxInfo): string {
  const r = fx.perEur[code]
  if (!r) return `${currencyLabel(code)} : taux manquant`
  return `1 EUR = ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: r >= 100 ? 3 : 4 }).format(r)} ${currencyLabel(code)}${isFixed(code, fx) ? " (parité fixe)" : ""}`
}

/**
 * Discreet ⓘ (OBS-001, GEG 16/11/2026): the conversion details are never shown permanently; they appear on hover
 * (or on tap / click on a phone) in a small panel. Rendered in the page (hidden) so that screen readers and tests
 * can read them.
 */
export function InfoTip({ lines, warn = false, label = "Détail de la conversion", align = "right", className = "" }: {
  lines: string[]; warn?: boolean; label?: string; align?: "left" | "right"; className?: string
}) {
  // panel placed relative to the WINDOW (position: fixed), so that cards with hidden overflow never cut it
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [pinned, setPinned] = useState(false)
  const place = (el: HTMLElement) => {
    const r = el.getBoundingClientRect(), w = Math.min(256, window.innerWidth * 0.8)
    const left = align === "right" ? Math.max(8, r.right - w) : Math.min(r.left, window.innerWidth - w - 8)
    setPos({ top: r.bottom + 4, left })
  }
  const open = !!pos
  return (
    <span className={`relative inline-flex align-baseline ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onMouseEnter={e => place(e.currentTarget)}
        onMouseLeave={() => { if (!pinned) setPos(null) }}
        onClick={e => { e.preventDefault(); e.stopPropagation(); if (pinned) { setPinned(false); setPos(null) } else { setPinned(true); place(e.currentTarget); window.addEventListener("scroll", () => { setPinned(false); setPos(null) }, { once: true, capture: true }) } }}
        onBlur={() => { setPinned(false); setPos(null) }}
        className={`cursor-help text-[11px] font-normal leading-none ${warn ? "text-amber-600" : "text-gray-400 hover:text-gray-600"}`}
        data-testid="fx-info"
      >ⓘ</button>
      <span
        role="tooltip"
        style={pos ? { position: "fixed", top: pos.top, left: pos.left } : undefined}
        className={`z-50 w-64 max-w-[80vw] rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-[11px] font-normal leading-snug text-gray-600 shadow-lg ${open ? "block" : "hidden"}`}
        data-testid="fx-details"
      >
        {lines.map(l => <span key={l} className={`block ${l.startsWith("⚠") ? "text-amber-700" : ""}`}>{l}</span>)}
      </span>
    </span>
  )
}

/** Lines of the ⓘ panel: date and source of the rates, rate of each currency concerned, indicative nature */
export function fxDetailLines(fx: FxInfo, currencies: string[]): string[] {
  const codes = [...new Set(currencies.map(c => c.toUpperCase()))].filter(c => c !== "EUR")
  const variable = codes.some(c => !isFixed(c, fx))
  return [
    ...(variable ? [
      fx.date ? `${fx.stale ? "⚠ " : ""}Taux du marché du ${fxDate(fx)}${fx.stale ? " (taux antérieurs : actualisation impossible)" : ""}` : "⚠ Aucun taux du marché disponible",
      `Source : ${fx.source}`,
    ] : []),
    ...codes.map(c => rateLine(c, fx)),
    "Conversion indicative : les montants des documents ne sont pas modifiés.",
  ]
}

/**
 * Amounts per currency, one per line (never added together), and, when `fx` is given, "Total ≈ EUR" below a dashed
 * line. The amounts inherit the size, weight and colour of the surrounding text; `size="sm"` tightens the spacing
 * for table footers and tooltips.
 */
export default function CurrencyAmounts({ byCurrency, fx, size = "md", emptyLabel = "—", className = "" }: {
  byCurrency: Record<string, number>
  /** market rates; without them no EUR total is shown (e.g. a payment, which is always in one currency) */
  fx?: FxInfo | null
  size?: "sm" | "md"
  emptyLabel?: string
  className?: string
  /** @deprecated kept for older callers, same as size="sm" */
  compact?: boolean
}) {
  const entries = Object.entries(byCurrency)
    .filter(([, v]) => v !== 0 && Number.isFinite(v))
    .map(([c, v]) => [c.toUpperCase(), v] as const)
    .sort(([a], [b]) => (a === "GNF" ? -1 : b === "GNF" ? 1 : a.localeCompare(b)))
  if (!entries.length) return <span className={className}>{emptyLabel}</span>

  const sm = size === "sm"
  const onlyEur = entries.length === 1 && entries[0][0] === "EUR"
  const total = fx && !onlyEur ? eurTotal(Object.fromEntries(entries), fx) : null
  const variable = fx ? entries.filter(([c]) => c !== "EUR" && !isFixed(c, fx)).length > 0 : false
  const stale = !!fx?.stale && variable
  const details = fx && total ? fxDetailLines(fx, entries.map(([c]) => c)) : []

  return (
    <span className={`inline-grid w-full max-w-full grid-cols-[auto_1fr] items-baseline ${sm ? "gap-x-2 gap-y-0" : "gap-x-3 gap-y-0.5"} ${className}`} data-testid="currency-amounts">
      {entries.map(([c, v]) => (
        <span key={c} className="contents" data-testid="currency-line" data-currency={c}>
          <span className={`justify-self-start whitespace-nowrap rounded bg-gray-100 px-1.5 py-px font-semibold tracking-wide text-gray-600 ${sm ? "text-[10px]" : "text-[11px]"}`}>{currencyLabel(c)}</span>
          <span className="text-right tabular-nums whitespace-nowrap">{formatSummaryAmount(v, c)}</span>
        </span>
      ))}
      {total && (
        <span className={`col-span-2 mt-1 border-t border-dashed border-gray-200 ${sm ? "pt-1" : "pt-1.5"}`} data-testid="eur-total">
          {total.eur !== null ? (
            <span className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className={`font-normal text-gray-500 ${sm ? "text-[10px]" : "text-xs"}`}>Total</span>
              <span className="ml-auto inline-flex items-baseline gap-1.5">
                <span className={`tabular-nums whitespace-nowrap font-semibold text-gray-800 ${sm ? "text-xs" : "text-sm"}`} data-testid="eur-total-amount">≈ {formatEurTotal(total.eur)}</span>
                <InfoTip lines={details} warn={stale} />
              </span>
            </span>
          ) : (
            <span className={`font-normal text-amber-700 ${sm ? "text-[10px]" : "text-xs"}`}>⚠ Total EUR indisponible : taux manquant ({total.missing.map(currencyLabel).join(", ")})</span>
          )}
        </span>
      )}
    </span>
  )
}
