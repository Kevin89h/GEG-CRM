import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/access"

// GET /api/exchange-rates?from=XOF&to=GNF
// Returns the latest REFERENCE rate for a currency pair, trying both directions, with its date and origin (D-07 / D-08).
// Full precision (no rounding). The rate applied to a payment is stored with the payment and never recalculated.
export async function GET(req: Request)  {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 })
    if (from === to) return NextResponse.json({ rate: 1 })

    const { db } = await createCompanyClient()
    const latest = (f: string, t: string) => db
      .from("exchange_rates")
      .select("rate, effective_date, notes")
      .eq("from_currency", f)
      .eq("to_currency", t)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: direct } = await latest(from, to)
    if (direct && Number(direct.rate) > 0) return NextResponse.json({ rate: Number(direct.rate), effective_date: direct.effective_date, notes: direct.notes, inverse: false })

    // Try inverse rate
    const { data: inverse } = await latest(to, from)
    if (inverse && Number(inverse.rate) > 0) return NextResponse.json({ rate: 1 / Number(inverse.rate), effective_date: inverse.effective_date, notes: inverse.notes, inverse: true })

    return NextResponse.json({ rate: null })

  } catch (err) {
    return errorResponse(err)
  }
}
