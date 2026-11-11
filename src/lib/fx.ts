// Market exchange rates for STEERING INDICATORS ONLY (G1, decision GEG of 11/11/2026).
// - Amounts are always shown in their original currency; a consolidated total in EUR is added next to them.
// - Rates come from a public market API, refreshed daily (cron) and on demand when the stored rates are older than 24 h.
// - They are stored in public.market_rates, separate from geg_*.exchange_rates (purchase / supplier-invoice conversions),
//   so no amount, currency or rate recorded in documents or accounting is ever changed.
// Server only.

import { createAdminClient } from "@/lib/supabase/admin"

export const FX_SOURCE = "open.er-api.com (ExchangeRate-API, taux du marché)"
// FX_API_URL only lets the tests simulate an unavailable API; production uses the public endpoint
const API_URL = process.env.FX_API_URL || "https://open.er-api.com/v6/latest/EUR"
const REFRESH_AFTER_MS = 24 * 3600 * 1000   // try a refresh when the stored rates are older than this
const STALE_AFTER_MS = 48 * 3600 * 1000     // beyond this, the consolidated total is flagged as based on older rates

export interface MarketRates {
  /** units of each currency for 1 EUR (EUR = 1) */
  perEur: Record<string, number>
  /** market date of the rates (yyyy-mm-dd), null when no rate is stored at all */
  date: string | null
  fetchedAt: string | null
  source: string
  /** true when the rates are older than 48 h (API unavailable): shown with a clear warning */
  stale: boolean
}

type Db = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

/** Fetches today's market rates (base EUR) and stores them. Returns the number of currencies stored, or throws. */
export async function refreshMarketRates(db?: Db): Promise<number> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(API_URL, { signal: ctrl.signal, cache: "no-store" })
    if (!res.ok) throw new Error(`API des taux indisponible (HTTP ${res.status})`)
    const data = await res.json() as { result?: string; base_code?: string; rates?: Record<string, number>; time_last_update_unix?: number }
    if (data.result !== "success" || data.base_code !== "EUR" || !data.rates) throw new Error("Réponse de l'API des taux invalide")
    // sanity check: the CFA franc (XOF) is pegged to the euro at 655.957
    const xof = data.rates.XOF
    if (xof && Math.abs(xof - 655.957) / 655.957 > 0.02) throw new Error("Taux XOF incohérent : réponse rejetée")
    const rateDate = new Date((data.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10)
    const rows = Object.entries(data.rates)
      .filter(([c, r]) => /^[A-Z]{3}$/.test(c) && Number(r) > 0)
      .map(([currency, per_eur]) => ({ rate_date: rateDate, currency, per_eur, source: FX_SOURCE, fetched_at: new Date().toISOString() }))
    const target = db ?? (createAdminClient() as unknown as Db)
    const { error } = await target.from("market_rates").upsert(rows, { onConflict: "rate_date,currency" })
    if (error) throw new Error(error.message)
    return rows.length
  } finally {
    clearTimeout(timer)
  }
}

/** Latest stored market rates; refreshes them first when they are older than 24 h (failure is tolerated). */
export async function getMarketRates(): Promise<MarketRates> {
  const db = createAdminClient() as unknown as Db
  const read = async () => {
    const { data: last } = await db.from("market_rates").select("rate_date, fetched_at").order("rate_date", { ascending: false }).order("fetched_at", { ascending: false }).limit(1).maybeSingle()
    if (!last) return null
    const { data } = await db.from("market_rates").select("currency, per_eur, fetched_at, source").eq("rate_date", last.rate_date)
    const perEur: Record<string, number> = { EUR: 1 }
    for (const r of data ?? []) perEur[r.currency] = Number(r.per_eur)
    return { perEur, date: last.rate_date as string, fetchedAt: last.fetched_at as string, source: (data?.[0]?.source as string) ?? FX_SOURCE }
  }
  let rates = await read()
  if (!rates || Date.now() - new Date(rates.fetchedAt ?? 0).getTime() > REFRESH_AFTER_MS) {
    try { await refreshMarketRates(db); rates = await read() } catch { /* keep the older rates, flagged below */ }
  }
  if (!rates) return { perEur: { EUR: 1 }, date: null, fetchedAt: null, source: FX_SOURCE, stale: true }
  return { ...rates, stale: Date.now() - new Date(rates.fetchedAt ?? 0).getTime() > STALE_AFTER_MS }
}

export interface Consolidated {
  /** amounts kept in their original currency (never added across currencies) */
  byCurrency: Record<string, number>
  /** total converted to EUR, null when a currency has no market rate */
  eur: number | null
  /** currencies without a market rate (the EUR total is then unavailable) */
  missing: string[]
}

/** Adds amounts per currency (never across currencies) */
export function sumByCurrency<T>(rows: T[] | null | undefined, amount: (r: T) => number | null | undefined, currency: (r: T) => string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows ?? []) {
    const a = Number(amount(r) ?? 0)
    if (!a) continue
    const c = (currency(r) || "GNF").toUpperCase()
    out[c] = (out[c] ?? 0) + a
  }
  return out
}

/** Consolidates per-currency amounts into EUR with the same market rates for every indicator (steering only) */
export function consolidate(byCurrency: Record<string, number>, fx: MarketRates): Consolidated {
  const missing = Object.keys(byCurrency).filter(c => byCurrency[c] !== 0 && !fx.perEur[c])
  const eur = missing.length ? null : Object.entries(byCurrency).reduce((s, [c, v]) => s + v / fx.perEur[c], 0)
  return { byCurrency, eur, missing }
}

/** Converts one amount to EUR (null when the currency has no market rate) */
export function toEur(amount: number, currency: string | null | undefined, fx: MarketRates): number | null {
  const r = fx.perEur[(currency || "GNF").toUpperCase()]
  return r ? amount / r : null
}

/** Plain description of the rates used, for the screens and the daily report */
export function fxCaption(fx: MarketRates): string {
  if (!fx.date) return "Total en EUR indisponible : aucun taux du marché n'a encore pu être récupéré."
  const d = new Date(fx.date + "T00:00:00Z").toLocaleDateString("fr-FR", { timeZone: "UTC" })
  return fx.stale
    ? `Taux du marché du ${d} (antérieurs : actualisation impossible) — source ${fx.source}`
    : `Taux du marché du ${d} — source ${fx.source}`
}
