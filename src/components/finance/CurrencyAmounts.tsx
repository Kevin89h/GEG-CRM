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

function rateLine(code: string, fx: FxInfo): string {
  const r = fx.perEur[code]
  return r ? `1 EUR = ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: r >= 100 ? 3 : 4 }).format(r)} ${currencyLabel(code)}` : `${currencyLabel(code)} : taux manquant`
}

/** "Taux du marché du 11/11/2026 — source …" (with a warning when the rates are older or unavailable) */
export function FxNote({ fx, className = "" }: { fx: FxInfo; className?: string }) {
  if (!fx.date) return <p className={`text-[11px] text-amber-700 ${className}`}>⚠ Total consolidé en EUR indisponible : aucun taux du marché n&apos;a pu être récupéré. Les montants sont affichés dans leurs devises d&apos;origine.</p>
  return (
    <p className={`text-[11px] ${fx.stale ? "text-amber-700" : "text-gray-400"} ${className}`}>
      {fx.stale ? "⚠ " : ""}Total en EUR indicatif, au taux du marché du {fxDate(fx)}{fx.stale ? " (taux antérieurs : actualisation impossible)" : ""} — source : {fx.source}. Les montants des documents ne sont pas modifiés.
    </p>
  )
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
  const [open, setOpen] = useState(false)
  const entries = Object.entries(byCurrency)
    .filter(([, v]) => v !== 0 && Number.isFinite(v))
    .map(([c, v]) => [c.toUpperCase(), v] as const)
    .sort(([a], [b]) => (a === "GNF" ? -1 : b === "GNF" ? 1 : a.localeCompare(b)))
  if (!entries.length) return <span className={className}>{emptyLabel}</span>

  const sm = size === "sm"
  const onlyEur = entries.length === 1 && entries[0][0] === "EUR"
  const total = fx && !onlyEur ? eurTotal(Object.fromEntries(entries), fx) : null
  const details = fx && total ? [
    fx.date ? `Taux du marché du ${fxDate(fx)}${fx.stale ? " (taux antérieurs : actualisation impossible)" : ""}` : "Aucun taux du marché disponible",
    `Source : ${fx.source}`,
    ...entries.filter(([c]) => c !== "EUR").map(([c]) => rateLine(c, fx)),
    "Total indicatif : les montants des documents ne sont pas modifiés.",
  ] : []

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
              <span className={`font-normal text-gray-500 ${sm ? "text-[10px]" : "text-xs"}`}>
                Total ≈ EUR
                <button
                  type="button"
                  title={details.join("\n")}
                  aria-expanded={open}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
                  className={`ml-1.5 cursor-help border-b border-dotted ${fx!.stale ? "border-amber-500 text-amber-700" : "border-gray-300 text-gray-400 hover:text-gray-600"}`}
                >
                  ⓘ {fx!.date ? `taux du ${fxDate(fx!, true)}` : "taux"}{fx!.stale ? " (taux antérieurs)" : ""}
                </button>
              </span>
              <span className={`ml-auto tabular-nums whitespace-nowrap font-semibold text-gray-800 ${sm ? "text-xs" : "text-sm"}`} data-testid="eur-total-amount">≈ {formatEurTotal(total.eur)}</span>
            </span>
          ) : (
            <span className={`font-normal text-amber-700 ${sm ? "text-[10px]" : "text-xs"}`}>⚠ Total EUR indisponible : taux manquant ({total.missing.map(currencyLabel).join(", ")})</span>
          )}
          {open && total.eur !== null && (
            <span className="mt-1 block rounded-md bg-gray-50 px-2 py-1.5 text-[11px] font-normal leading-snug text-gray-600" data-testid="fx-details">
              {details.map(l => <span key={l} className="block">{l}</span>)}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
