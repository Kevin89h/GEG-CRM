import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse, requirePermission } from "@/lib/access"
import { NOT_FOUND_MESSAGE, loadCatalog, normalize, similarItems } from "@/lib/catalog"

// GET ?q=… — catalogue search for sales lines and product creation (H1, anti-duplicate check).
// Returns active and inactive close matches with the characteristics that distinguish them
// (designation, reference, type, category, unit, packagings, viscosity). Never purchase prices nor internal data.
export async function GET(req: NextRequest) {
  try {
    await requirePermission("produits.voir")
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim()
    if (q.length < 2) return NextResponse.json({ query: q, results: [], notFoundMessage: null })
    const { db } = await createCompanyClient()
    const items = await loadCatalog(db)
    const nq = normalize(q)
    const exact = items.filter(i => normalize(i.name) === nq || (i.reference && normalize(i.reference) === nq))
    const similar = similarItems(q, items).filter(c => !exact.some(e => e.id === c.id))
    const results = [...exact.map(e => ({ ...e, score: 1, reasons: ["correspondance exacte"] })), ...similar]
    const anyActive = results.some(r => r.is_active)
    return NextResponse.json({ query: q, results, notFoundMessage: anyActive ? null : NOT_FOUND_MESSAGE })
  } catch (err) {
    return errorResponse(err)
  }
}
