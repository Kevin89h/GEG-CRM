import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

async function receptionCount(db: { from: (t: string) => any }, id: string): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { count } = await db.from("purchase_receptions").select("id", { count: "exact", head: true }).eq("order_id", id)
  return count ?? 0
}

// Void of a purchase order WITHOUT any reception only (B1)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()
  const { data: po } = await db.from("purchase_orders").select("status").eq("id", id).single()
  if (!po) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
  if (["partial", "received"].includes(po.status) || (await receptionCount(db, id)) > 0)
    return NextResponse.json({ error: "Commande déjà réceptionnée : elle ne peut pas être annulée" }, { status: 409 })

  const { error } = await db.from("purchase_orders").update({ status: "cancelled" }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  return NextResponse.json({ ok: true })
}
