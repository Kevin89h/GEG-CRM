// Document exchange rates (geg_*.exchange_rates): refresh from the provider (D-07 / D-08, GEG 16/11/2026). Server only.
// - Rates are computed with full precision (stored as numeric(24,12) since migration 20261116150000).
// - Each refresh INSERTS a new dated set: rates already stored, and the rates applied to existing documents and
//   payments, are never changed or recalculated.
// - The daily automatic refresh runs once a day at most; the manual button keeps working at any time.
// - On failure nothing is written: the last available rates stay in use (with an alert when they get old).

import { DOC_PAIRS, XOF_PER_EUR } from "@/lib/document-rates-shared"

export const DOC_RATES_SOURCE = "open.er-api.com (ExchangeRate-API)"
export const AUTO_NOTE = `Actualisation automatique quotidienne — ${DOC_RATES_SOURCE}`
export const MANUAL_NOTE = `Actualisation manuelle — ${DOC_RATES_SOURCE}`
// only lets the tests simulate an unavailable provider
const API_URL = process.env.DOC_FX_API_URL || "https://open.er-api.com/v6/latest/USD"

type Db = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

export interface DocRateRow { from_currency: string; to_currency: string; rate: number; effective_date: string; notes: string }

/** Fetches the provider (base USD) and derives the 7 reference pairs with full precision. Throws on any problem. */
export async function fetchDocumentRates(note: string, today = new Date().toISOString().slice(0, 10)): Promise<DocRateRow[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(API_URL, { signal: ctrl.signal, cache: "no-store" })
    if (!res.ok) throw new Error(`Fournisseur des taux indisponible (HTTP ${res.status})`)
    const data = await res.json() as { result?: string; base_code?: string; rates?: Record<string, number> }
    if (data.result !== "success" || data.base_code !== "USD" || !data.rates) throw new Error("Réponse du fournisseur des taux invalide")
    const fromUsd = (c: string) => (c === "USD" ? 1 : Number(data.rates![c]))
    // sanity check: the CFA franc (XOF) is pegged to the euro at 655.957
    const xofPerEur = fromUsd("XOF") / fromUsd("EUR")
    if (!(Math.abs(xofPerEur - 655.957) / 655.957 <= 0.02)) throw new Error("Taux XOF incohérent : réponse rejetée")
    return DOC_PAIRS.map(({ from, to }) => {
      const f = fromUsd(from), t = fromUsd(to)
      if (!(f > 0) || !(t > 0)) throw new Error(`Taux manquant pour ${from} ou ${to}`)
      // D-06: XOF → EUR is the fixed parity, whatever the provider's cross rate (≈ 0.015 % away from it)
      const rate = from === "XOF" && to === "EUR" ? 1 / XOF_PER_EUR : t / f
      return { from_currency: from, to_currency: to, rate: Number(rate.toFixed(12)), effective_date: today, notes: note }
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Refreshes the reference rates of one company.
 * mode "auto": at most once a day (skipped when today's automatic set already exists).
 * mode "manual": always inserts a new set (the "Actualiser les taux" button).
 */
export async function refreshDocumentRates(db: Db, mode: "auto" | "manual"): Promise<{ inserted: number; skipped: boolean; rows: DocRateRow[] }> {
  const today = new Date().toISOString().slice(0, 10)
  if (mode === "auto") {
    const { data: existing } = await db.from("exchange_rates").select("id").eq("effective_date", today).eq("notes", AUTO_NOTE).limit(1)
    if (existing && existing.length) return { inserted: 0, skipped: true, rows: [] }
  }
  const rows = await fetchDocumentRates(mode === "auto" ? AUTO_NOTE : MANUAL_NOTE, today)
  const { error } = await db.from("exchange_rates").insert(rows)
  if (error) throw new Error(error.message)
  return { inserted: rows.length, skipped: false, rows }
}
