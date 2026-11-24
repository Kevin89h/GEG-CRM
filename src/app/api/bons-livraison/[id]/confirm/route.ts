import { NextRequest, NextResponse } from "next/server"
import { getCompanySchema } from "@/lib/company"
import { createSchemaClient } from "@/lib/supabase/admin"
import { errorResponse, requireSchemaAccess } from "@/lib/access"
import { stockEngine } from "@/lib/stock-engine"

// POST { lines: [{ id, quantity, warehouse_id }], splits?: [{ split_of, quantity, warehouse_id }] } — confirms a
// delivery note (permission "livraisons.confirmer", checked by the middleware).
// Phase 1 (M1, A1, A2, D2, D6): one database transaction (livraison_confirmer):
// - the delivery note is locked: a draft is confirmed ONCE (double click / two users: the second one is refused);
// - quantities are capped by what remains to deliver on the invoice (or the quote), all confirmed notes included;
// - every goods line needs a warehouse chosen by the user (never chosen automatically); a line can be split
//   between several warehouses; the "Livraison directe" location only for what was received directly for that line;
// - the stock is checked at this very moment and never becomes negative (no derogation any more: decision Q1);
// - stock moves (linked to the note and its line), levels, quote quantities and the status are written together.
// Services, discounts and comments never move stock. The author is the signed-in user.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const schema = await getCompanySchema()
    const access = await requireSchemaAccess(schema)
    const body = await req.json()
    const lines = Array.isArray(body.lines) ? body.lines : null
    if (!lines) return NextResponse.json({ error: "Lignes du bon de livraison manquantes" }, { status: 400 })
    const edits = [
      ...lines.filter((l: { line_type?: string }) => l.line_type !== "comment")
        .map((l: { id: string; quantity: number; warehouse_id: string | null }) => ({ id: l.id, quantity: Number(l.quantity), warehouse_id: l.warehouse_id ?? null })),
      ...(Array.isArray(body.splits) ? body.splits : [])
        .map((s: { split_of: string; quantity: number; warehouse_id: string | null }) => ({ split_of: s.split_of, quantity: Number(s.quantity), warehouse_id: s.warehouse_id ?? null })),
    ]
    const r = await stockEngine(createSchemaClient(schema), "livraison_confirmer", { p_dn: id, p_lines: edits, p_user: access.userId })
    return r.ok ? NextResponse.json({ ok: true, ...r.data }) : r.response
  } catch (err) {
    return errorResponse(err)
  }
}
