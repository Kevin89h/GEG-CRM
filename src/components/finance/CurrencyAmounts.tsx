// Steering indicators (G1): amounts in their ORIGINAL currencies, plus a consolidated total in EUR computed with the
// latest market rates. Pure presentation (no hook), usable from server and client components.
import { formatCurrency } from "@/lib/utils"

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

export function fxDate(fx: FxInfo): string {
  return fx.date ? new Date(fx.date + "T00:00:00Z").toLocaleDateString("fr-FR", { timeZone: "UTC" }) : ""
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

/** Amounts per currency (never added together) + "≈ total in EUR" */
export default function CurrencyAmounts({ byCurrency, fx, compact = false, emptyLabel = "0" }: {
  byCurrency: Record<string, number>; fx: FxInfo; compact?: boolean; emptyLabel?: string
}) {
  const entries = Object.entries(byCurrency).filter(([, v]) => v !== 0).sort(([a], [b]) => (a === "GNF" ? -1 : b === "GNF" ? 1 : a.localeCompare(b)))
  if (!entries.length) return <span>{emptyLabel}</span>
  const { eur, missing } = eurTotal(byCurrency, fx)
  const onlyEur = entries.length === 1 && entries[0][0] === "EUR"
  return (
    <span className="inline-flex flex-col gap-0.5" data-testid="currency-amounts">
      <span className={compact ? "" : "leading-tight"}>{entries.map(([c, v]) => formatCurrency(v, c)).join(" · ")}</span>
      {!onlyEur && (eur !== null
        ? <span className="text-xs font-normal text-gray-500" data-testid="eur-total">≈ {formatCurrency(eur, "EUR")} au total{fx.stale ? " (taux antérieurs)" : ""}</span>
        : <span className="text-xs font-normal text-amber-700" data-testid="eur-total">Total EUR indisponible (taux manquant : {missing.join(", ")})</span>)}
    </span>
  )
}
