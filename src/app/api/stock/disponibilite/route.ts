import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse, requirePermission } from "@/lib/access"

// GET ?ids=a,b — stock per warehouse for the given products (quantities only, never values).
// Used on quotes, invoices (R3 alerts and A2 availability). Services and discounts are flagged and never checked (R5).
// Only ACTIVE PHYSICAL warehouses count (the non-physical "Livraison directe" location is not a stock).
// A2 (GEG 24/11/2026): PRD code, brand, packaging and unit of each sheet are returned for display — internal screens only,
// warehouses are never printed on customer documents.
export async function GET(req: NextRequest) {
  try {
    await requirePermission("stock.voir")
    const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 200)
    if (!ids.length) return NextResponse.json({ products: {} })
    const { db } = await createCompanyClient()
    // GEG Singapour has no product code: fall back to the columns common to both companies
    const first = await db.from("products").select("id, name, product_type, product_code, brand, packaging, packaging_other, unit:units(name)").in("id", ids)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const products: any[] | null = first.error ? (await db.from("products").select("id, name, product_type, brand, packaging, packaging_other, unit:units(name)").in("id", ids)).data : first.data
    const [{ data: levels }, { data: warehouses }] = await Promise.all([
      db.from("stock_levels").select("product_id, warehouse_id, quantity").in("product_id", ids),
      db.from("warehouses").select("id, name").eq("is_active", true).eq("kind", "physical").order("name"),
    ])
    const out: Record<string, { name: string; service: boolean; total: number; warehouses: { id: string; name: string; quantity: number }[]; product_code: string | null; brand: string | null; packaging: string | null; unit: string | null }> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (products ?? []) as any[]) {
      const ws = ((warehouses ?? []) as { id: string; name: string }[]).map(w => ({
        id: w.id, name: w.name,
        quantity: Number((levels ?? []).find(l => l.product_id === p.id && l.warehouse_id === w.id)?.quantity ?? 0),
      }))
      const unit = Array.isArray(p.unit) ? p.unit[0] : p.unit
      out[p.id] = {
        name: p.name, service: ["service", "discount"].includes(p.product_type), total: ws.reduce((s, w) => s + w.quantity, 0), warehouses: ws,
        product_code: p.product_code ?? null, brand: p.brand ?? null,
        packaging: p.packaging === "Autre" ? p.packaging_other ?? "Autre" : p.packaging ?? null, unit: unit?.name ?? null,
      }
    }
    return NextResponse.json({ products: out })
  } catch (err) {
    return errorResponse(err)
  }
}
