import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse, requirePermission } from "@/lib/access"

// GET ?ids=a,b — stock per warehouse for the given products (quantities only, never values).
// Used for the non-blocking alerts on quotes and invoices (R3). Services are flagged and never checked (R5).
export async function GET(req: NextRequest) {
  try {
    await requirePermission("stock.voir")
    const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 200)
    if (!ids.length) return NextResponse.json({ products: {} })
    const { db } = await createCompanyClient()
    const [{ data: products }, { data: levels }, { data: warehouses }] = await Promise.all([
      db.from("products").select("id, name, product_type").in("id", ids),
      db.from("stock_levels").select("product_id, warehouse_id, quantity").in("product_id", ids),
      db.from("warehouses").select("id, name, is_active"),
    ])
    const out: Record<string, { name: string; service: boolean; total: number; warehouses: { id: string; name: string; quantity: number }[] }> = {}
    for (const p of products ?? []) {
      const ws = (levels ?? []).filter(l => l.product_id === p.id).map(l => ({
        id: l.warehouse_id, name: (warehouses ?? []).find(w => w.id === l.warehouse_id)?.name ?? "—", quantity: Number(l.quantity),
      }))
      out[p.id] = { name: p.name, service: p.product_type === "service", total: ws.reduce((s, w) => s + w.quantity, 0), warehouses: ws }
    }
    return NextResponse.json({ products: out })
  } catch (err) {
    return errorResponse(err)
  }
}
