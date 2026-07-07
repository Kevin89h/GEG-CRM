import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminSupabase } from "@supabase/supabase-js"
import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"

interface StockMove {
  type: "in"
  product_id: string | null
  to_warehouse_id: string | null
  quantity: number
  notes: string
  user_id: string
}

interface ProductUpdate {
  product_id: string
  buy_price: number
  buy_price_currency: string
}

interface ReceptionLine {
  order_line_id: string | null
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  warehouse_id: string | null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { stockMoves, productUpdates, receptionLines } = body as {
    stockMoves: StockMove[]
    productUpdates: ProductUpdate[]
    receptionLines?: ReceptionLine[]
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { db } = await createCompanyClient()
  const schema = await getCompanySchema()
  const adminDb = createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ).schema(schema)

  // 1. Créer le bon de réception (admin pour bypasser RLS)
  const { data: order } = await db.from("purchase_orders").select("number").eq("id", id).single()
  const { count } = await adminDb.from("purchase_receptions").select("id", { count: "exact", head: true })
  const receptionNumber = `BR/${new Date().getFullYear()}/${String((count ?? 0) + 1).padStart(5, "0")}`

  const { data: reception, error: recErr } = await adminDb.from("purchase_receptions").insert([{
    order_id: id,
    number: receptionNumber,
    received_at: new Date().toISOString(),
    user_id: user?.id ?? null,
  }]).select("id").single()

  if (recErr || !reception) {
    return NextResponse.json({ error: `reception: ${recErr?.message}` }, { status: 400 })
  }

  // 2. Lignes du bon de réception
  if (receptionLines && receptionLines.length > 0) {
    await adminDb.from("purchase_reception_lines").insert(
      receptionLines.map(l => ({
        reception_id: reception.id,
        order_line_id: l.order_line_id,
        product_id: l.product_id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        warehouse_id: l.warehouse_id,
      }))
    )
  }

  // 3. Mouvements de stock
  if (stockMoves.length > 0) {
    const { error: moveErr } = await db.from("stock_moves").insert(stockMoves)
    if (moveErr) return NextResponse.json({ error: `stock_moves: ${moveErr.message}` }, { status: 400 })

    for (const m of stockMoves) {
      if (!m.product_id || !m.to_warehouse_id) continue
      const { data: level } = await db
        .from("stock_levels")
        .select("quantity")
        .eq("product_id", m.product_id)
        .eq("warehouse_id", m.to_warehouse_id)
        .maybeSingle()
      const current = Number(level?.quantity ?? 0)
      await db.from("stock_levels").upsert(
        { product_id: m.product_id, warehouse_id: m.to_warehouse_id, quantity: current + m.quantity },
        { onConflict: "product_id,warehouse_id" }
      )
    }
  }

  // 4. Mise à jour prix d'achat produits
  for (const u of productUpdates) {
    await db.from("products").update({
      buy_price: u.buy_price,
      buy_price_currency: u.buy_price_currency,
    }).eq("id", u.product_id)
  }

  // 5. Statut PO → received
  const { error: orderErr } = await db.from("purchase_orders").update({ status: "received" }).eq("id", id)
  if (orderErr) return NextResponse.json({ error: `purchase_orders: ${orderErr.message}` }, { status: 400 })

  return NextResponse.json({ ok: true, receptionId: reception.id, receptionNumber, orderNumber: order?.number })
}
