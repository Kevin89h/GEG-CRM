import { NextRequest, NextResponse } from "next/server"
import { createSchemaClient } from "@/lib/supabase/admin"
import { errorResponse, requireSchemaAccess } from "@/lib/access"
import { getCompanySchema } from "@/lib/company"
import { stockEngine } from "@/lib/stock-engine"

// POST { type, product_id, from_warehouse_id, to_warehouse_id, quantity, notes, reason } — manual stock operation
// (permission "stock.mouvement_manuel", checked by the middleware). Phase 1 (M1, A5, GEG 24/11/2026): one database
// transaction (stock_appliquer) — stocks locked, checked BEFORE writing, never negative, the move and the levels are
// written together or not at all, precise refusal message (product, warehouse, requested, available).
export async function POST(req: NextRequest) {
  try {
    const schema = await getCompanySchema()
    const access = await requireSchemaAccess(schema)
    const body = await req.json()
    const r = await stockEngine(createSchemaClient(schema), "stock_appliquer", {
      p_type: String(body.type ?? ""),
      p_product: body.product_id || null,
      p_from: body.from_warehouse_id || null,
      p_to: body.to_warehouse_id || null,
      p_quantity: body.quantity === "" || body.quantity == null ? null : Number(body.quantity),
      p_user: access.userId,
      p_notes: body.notes ? String(body.notes) : null,
      p_reason: body.reason ? String(body.reason) : null,
    })
    return r.ok ? NextResponse.json(r.data) : r.response
  } catch (err) {
    return errorResponse(err)
  }
}
