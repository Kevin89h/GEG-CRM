import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

const PAIRS = [
  { from: "USD", to: "GNF" },
  { from: "EUR", to: "GNF" },
  { from: "XOF", to: "GNF" },
  { from: "EUR", to: "USD" },
  { from: "USD", to: "EUR" },
  { from: "XOF", to: "USD" },
  { from: "XOF", to: "EUR" },
]

export async function POST() {
  try {
    // Fetch all rates in one call using USD as base, then derive cross rates
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 0 } })
    if (!res.ok) return NextResponse.json({ error: "Echec de la récupération des taux" }, { status: 502 })

    const data = await res.json()
    const ratesFromUSD: Record<string, number> = data.rates

    // Convert: rate(A→B) = ratesFromUSD[B] / ratesFromUSD[A]
    function getRate(from: string, to: string): number {
      const fromRate = from === "USD" ? 1 : ratesFromUSD[from]
      const toRate = to === "USD" ? 1 : ratesFromUSD[to]
      if (!fromRate || !toRate) throw new Error(`Taux manquant pour ${from} ou ${to}`)
      return toRate / fromRate
    }

    const { db } = await createCompanyClient()
    const today = new Date().toISOString().slice(0, 10)

    const rows = PAIRS.map(({ from, to }) => ({
      from_currency: from,
      to_currency: to,
      rate: getRate(from, to),
      effective_date: today,
      notes: "Mis à jour automatiquement via open.er-api.com",
    }))

    const { error } = await db.from("exchange_rates").insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, updated: rows.length, rates: rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
