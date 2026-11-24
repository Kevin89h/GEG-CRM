import { NextRequest, NextResponse } from "next/server"
import { nextReceptionNumber } from "@/lib/numbering"
import { createSchemaClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"
import { errorResponse, hasPermission, requireSchemaAccess } from "@/lib/access"
import { stockEngine } from "@/lib/stock-engine"

interface ReceptionLine {
  order_line_id: string
  quantity: number
  unit_price?: number
  warehouse_id: string | null
  /** M3: client invoice line, for a direct supplier → customer delivery ("Livraison directe" location) */
  invoice_line_id?: string | null
  notes?: string | null
}

interface ProductUpdate { product_id: string; buy_price: number; buy_price_currency: string }

// POST { receptionLines, productUpdates } — receives a purchase order (permission "achats.receptionner").
// Phase 1 (M1, D3, T-01, M3): one database transaction (achat_receptionner): order locked, each quantity capped by
// what REMAINS to receive on its line (a second reception can never count the whole order again), services received
// without stock, a warehouse for every goods line, the direct-delivery location only with the customer's invoice line,
// reception + lines + stock moves (linked to the reception lines) + levels + qty_received + status written together.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const schema = await getCompanySchema()
    const access = await requireSchemaAccess(schema)
    const db = createSchemaClient(schema)
    const body = await req.json()
    const lines = (Array.isArray(body.receptionLines) ? body.receptionLines : []) as ReceptionLine[]
    if (!lines.length) return NextResponse.json({ error: "Aucune ligne à réceptionner" }, { status: 400 })

    const r = await stockEngine<{ reception_id: string; number: string; status: string }>(db, "achat_receptionner", {
      p_order: id,
      p_number: await nextReceptionNumber(db),
      p_lines: lines.map(l => ({
        order_line_id: l.order_line_id, quantity: Number(l.quantity), unit_price: Number(l.unit_price ?? 0),
        warehouse_id: l.warehouse_id ?? null, invoice_line_id: l.invoice_line_id ?? null, notes: l.notes ?? null,
      })),
      p_user: access.userId,
    })
    if (!r.ok) return r.response

    // purchase price of the received products (landed cost), only with "produits.prix_achat" and only for received lines
    const updates = (Array.isArray(body.productUpdates) ? body.productUpdates : []) as ProductUpdate[]
    if (updates.length && await hasPermission("produits.prix_achat", schema)) {
      const { data: received } = await db.from("purchase_reception_lines").select("product_id").eq("reception_id", r.data.reception_id)
      const ids = new Set(((received ?? []) as { product_id: string | null }[]).map(x => x.product_id))
      for (const u of updates.filter(u => ids.has(u.product_id))) {
        await db.from("products").update({ buy_price: u.buy_price, buy_price_currency: u.buy_price_currency }).eq("id", u.product_id)
      }
    }
    const { data: order } = await db.from("purchase_orders").select("number").eq("id", id).single()
    return NextResponse.json({ ok: true, receptionId: r.data.reception_id, receptionNumber: r.data.number, status: r.data.status, orderNumber: order?.number })
  } catch (err) {
    return errorResponse(err)
  }
}
