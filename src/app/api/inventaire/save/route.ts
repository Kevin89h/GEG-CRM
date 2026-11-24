import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse, requireSchemaAccess } from "@/lib/access"
import { stockEngine } from "@/lib/stock-engine"

interface AdjustmentItem {
  product_id: string
  warehouse_id: string
  newQuantity: number
  currentQuantity: number // quantity shown when the inventory screen was opened
}

// POST { adjustments, reason? } — inventory validation (permission "stock.inventaire", checked by the middleware).
// Phase 1 (M1, A5): one database transaction (inventaire_valider). Every counted line is compared with the stock
// RECORDED IN THE DATABASE at this very moment: if one changed since the screen was opened, NOTHING is written and
// the products are listed. Otherwise each gap is a new signed "adjustment" move (history never rewritten).
export async function POST(req: NextRequest) {
  try {
    const { db, schema } = await createCompanyClient()
    const access = await requireSchemaAccess(schema)
    const { adjustments, reason } = await req.json() as { adjustments: AdjustmentItem[]; reason?: string }
    if (!Array.isArray(adjustments) || !adjustments.length) return NextResponse.json({ error: "Aucune ligne d'inventaire" }, { status: 400 })
    const r = await stockEngine<{ count: number }>(db, "inventaire_valider", {
      p_items: adjustments.map(a => ({ product_id: a.product_id, warehouse_id: a.warehouse_id, counted: Number(a.newQuantity), shown: Number(a.currentQuantity) })),
      p_user: access.userId,
      p_reason: reason ?? null,
    })
    return r.ok ? NextResponse.json({ ok: true, count: r.data.count }) : r.response
  } catch (err) {
    return errorResponse(err)
  }
}
