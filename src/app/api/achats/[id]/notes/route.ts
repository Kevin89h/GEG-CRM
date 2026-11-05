import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createCompanyClient } from "@/lib/company"
import { errorResponse, requireUser } from "@/lib/access"

// Internal notes of a purchase order (A4): recorded in purchase_order_events (event_type "note"),
// shown in the order's side panel with author and date, audited by the database. No e-mail is sent.
// GET needs "achats.voir", POST "achats.modifier" (middleware).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { db } = await createCompanyClient()
    const { data, error } = await db.from("purchase_order_events")
      .select("id, payload, created_at, user_id")
      .eq("order_id", id).eq("event_type", "note")
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const ids = [...new Set((data ?? []).map(n => n.user_id).filter(Boolean))] as string[]
    const { data: people } = ids.length
      ? await createAdminClient().from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] }
    const name = (uid: string | null) => people?.find(p => p.id === uid)?.full_name || people?.find(p => p.id === uid)?.email || "—"
    return NextResponse.json({
      notes: (data ?? []).map(n => ({ id: n.id, text: (n.payload as { text?: string } | null)?.text ?? "", created_at: n.created_at, author: name(n.user_id) })),
    })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { text } = await req.json()
    const clean = typeof text === "string" ? text.trim() : ""
    if (!clean) return NextResponse.json({ error: "Message vide" }, { status: 400 })
    if (clean.length > 4000) return NextResponse.json({ error: "Message trop long (4 000 caractères maximum)" }, { status: 400 })
    const access = await requireUser()
    const { db } = await createCompanyClient()
    const { data: order } = await db.from("purchase_orders").select("id").eq("id", id).single()
    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    const { data, error } = await db.from("purchase_order_events")
      .insert([{ order_id: id, event_type: "note", payload: { text: clean }, user_id: access.userId }])
      .select("id, created_at")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id, created_at: data.created_at })
  } catch (err) {
    return errorResponse(err)
  }
}
