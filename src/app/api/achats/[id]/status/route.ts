import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:      ["confirmed", "cancelled"],
  confirmed:  ["ordered", "cancelled"],
  ordered:    ["in_transit", "cancelled"],
  in_transit: ["partial", "received", "cancelled"],
  partial:    ["received", "cancelled"],
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { status: string; notes?: string; user_id?: string }

  const { db } = await createCompanyClient()

  const { data: order, error: fetchErr } = await db
    .from("purchase_orders")
    .select("status")
    .eq("id", id)
    .single()

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
  }

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? []
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      { error: `Transition interdite : ${order.status} → ${body.status}` },
      { status: 422 }
    )
  }

  const { error: updateErr } = await db
    .from("purchase_orders")
    .update({ status: body.status })
    .eq("id", id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 })
  }

  await db.from("purchase_order_events").insert([{
    order_id:   id,
    event_type: "status_change",
    payload: {
      from:  order.status,
      to:    body.status,
      notes: body.notes ?? null,
    },
    user_id: body.user_id ?? null,
  }])

  return NextResponse.json({ ok: true })
}
