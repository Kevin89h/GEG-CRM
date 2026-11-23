import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse, requireSchemaAccess } from "@/lib/access"
import { CONCURRENT_MSG, casLevel, readLevel } from "@/lib/stock-write"

interface AdjustmentItem {
  product_id: string
  warehouse_id: string
  newQuantity: number
  currentQuantity: number // quantity shown when the inventory screen was opened
}

// POST { adjustments } — inventory validation (permission "stock.inventaire", checked by the middleware).
// Phase 0 of the stock reliability plan (A5, GEG 23/11/2026):
// - the gap is computed from the stock RECORDED IN THE DATABASE at validation time, never from the screen;
// - if the stock changed since the screen was opened, NOTHING is written and the products are listed: the user
//   must reload and check again;
// - counted quantities are never negative; each level change is a compare-and-set; author = signed-in user;
// - the history is never rewritten: each gap is a new "adjustment" move (Inventaire : avant → après).
export async function POST(req: NextRequest) {
  try {
    const { db, schema } = await createCompanyClient()
    const access = await requireSchemaAccess(schema)
    const { adjustments } = await req.json() as { adjustments: AdjustmentItem[] }
    if (!Array.isArray(adjustments)) return NextResponse.json({ error: "Aucune ligne d'inventaire" }, { status: 400 })
    const items = adjustments.filter(a => Number(a.newQuantity) !== Number(a.currentQuantity))
    if (items.some(a => !Number.isFinite(Number(a.newQuantity)) || Number(a.newQuantity) < 0)) {
      return NextResponse.json({ error: "Une quantité comptée ne peut pas être négative" }, { status: 400 })
    }

    // 1. compare what the user saw with what the database holds now
    const current = await Promise.all(items.map(a => readLevel(db, a.product_id, a.warehouse_id)))
    const changed = items.filter((a, i) => current[i].quantity !== Number(a.currentQuantity))
    if (changed.length) {
      const ids = [...new Set(changed.map(a => a.product_id))]
      const { data: prods } = await db.from("products").select("id, name, product_code").in("id", ids)
      const name = new Map(((prods ?? []) as { id: string; name: string; product_code: string | null }[]).map(p => [p.id, `${p.product_code ? p.product_code + " " : ""}${p.name}`]))
      return NextResponse.json({
        error: `Le stock a changé depuis l'ouverture de l'inventaire pour : ${changed.map(a => { const i = items.indexOf(a); return `${name.get(a.product_id) ?? a.product_id} (affiché ${a.currentQuantity}, actuel ${current[i].quantity})` }).join(", ")}. Rien n'a été enregistré : rechargez la page et vérifiez à nouveau.`,
        changed: changed.map(a => ({ product_id: a.product_id, warehouse_id: a.warehouse_id, shown: a.currentQuantity, current: current[items.indexOf(a)].quantity })),
      }, { status: 409 })
    }

    // 2. apply each gap: level (compare-and-set) then the adjustment move
    const errors: string[] = []
    let done = 0
    for (let i = 0; i < items.length; i++) {
      const a = items[i], before = current[i], next = Number(a.newQuantity)
      if (!(await casLevel(db, a.product_id, a.warehouse_id, before, next))) { errors.push(CONCURRENT_MSG); continue }
      const { error: moveErr } = await db.from("stock_moves").insert([{
        type: "adjustment", product_id: a.product_id, quantity: Math.abs(next - before.quantity),
        notes: `Inventaire : ${before.quantity} → ${next}`, to_warehouse_id: a.warehouse_id, from_warehouse_id: null, user_id: access.userId,
      }])
      if (moveErr) {
        await casLevel(db, a.product_id, a.warehouse_id, { exists: true, quantity: next }, before.quantity)
        errors.push(moveErr.message)
        continue
      }
      done++
    }
    if (errors.length) return NextResponse.json({ error: `${done} ligne(s) enregistrée(s), ${errors.length} non enregistrée(s) : ${[...new Set(errors)].join("; ")}`, count: done }, { status: 409 })
    return NextResponse.json({ ok: true, count: done })
  } catch (err) {
    return errorResponse(err)
  }
}
