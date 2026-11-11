import { NextResponse } from "next/server"
import { refreshMarketRates } from "@/lib/fx"

// Daily refresh of the MARKET exchange rates used by the steering indicators (G1).
// Called by the Vercel schedule (vercel.json) with the CRON_SECRET. The rates are also refreshed on demand
// when the stored ones are older than 24 h (src/lib/fx.ts). Recorded document rates are never touched.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const n = await refreshMarketRates()
    return NextResponse.json({ ok: true, currencies: n })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
