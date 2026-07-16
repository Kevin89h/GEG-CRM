import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

// GET /api/exchange-rates?from=XOF&to=GNF
// Returns the latest exchange rate for a currency pair, trying both directions.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 })
  if (from === to) return NextResponse.json({ rate: 1 })

  const { db } = await createCompanyClient()

  const { data: direct } = await db
    .from("exchange_rates")
    .select("rate")
    .eq("from_currency", from)
    .eq("to_currency", to)
    .order("effective_date", { ascending: false })
    .limit(1)
    .single()

  if (direct) return NextResponse.json({ rate: Number(direct.rate) })

  // Try inverse rate
  const { data: inverse } = await db
    .from("exchange_rates")
    .select("rate")
    .eq("from_currency", to)
    .eq("to_currency", from)
    .order("effective_date", { ascending: false })
    .limit(1)
    .single()

  if (inverse) return NextResponse.json({ rate: 1 / Number(inverse.rate) })

  return NextResponse.json({ rate: null })
}
