import { NextResponse } from "next/server"
import { refreshMarketRates } from "@/lib/fx"
import { refreshDocumentRates } from "@/lib/document-rates"
import { createSchemaClient } from "@/lib/supabase/admin"

// Daily refresh of the exchange rates, called by the Vercel schedule (vercel.json, 5:00 UTC) with the CRON_SECRET.
// 1. MARKET rates (public.market_rates) used by the indicative EUR totals (G1). Also refreshed on demand (src/lib/fx.ts).
// 2. DOCUMENT reference rates of GEG Guinée (D-08, GEG 16/11/2026): one automatic dated set per day at most, proposed
//    for NEW operations only. Existing rates and the rates applied to documents and payments are never touched.
// The two refreshes are independent: one failing never blocks the other, and on failure the last rates stay in use.
const DOC_RATE_SCHEMAS = ["geg_guinee"]

export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const out: Record<string, unknown> = {}
  try {
    out.market = { ok: true, currencies: await refreshMarketRates() }
  } catch (err) {
    out.market = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  for (const schema of DOC_RATE_SCHEMAS) {
    try {
      const r = await refreshDocumentRates(createSchemaClient(schema), "auto")
      out[`documents_${schema}`] = { ok: true, inserted: r.inserted, skipped: r.skipped }
    } catch (err) {
      out[`documents_${schema}`] = { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
  const allFailed = Object.values(out).every(v => !(v as { ok: boolean }).ok)
  return NextResponse.json({ ok: !allFailed, ...out }, { status: allFailed ? 502 : 200 })
}
