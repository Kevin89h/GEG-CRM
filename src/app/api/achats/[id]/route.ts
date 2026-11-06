import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse } from "@/lib/access"

// PATCH { notes } — conditions / notes PRINTED on the purchase order PDF (F5). Distinct from the internal
// notes of the side panel (/api/achats/[id]/notes), which are never printed. Needs "achats.modifier"
// (middleware); refused on a cancelled order. The change is recorded by the audit log.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    if (Object.keys(body).some(k => k !== "notes")) {
      return NextResponse.json({ error: "Seules les conditions imprimées peuvent être modifiées ici" }, { status: 400 })
    }
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 4000) : null
    const { db } = await createCompanyClient()
    const { data: order } = await db.from("purchase_orders").select("status").eq("id", id).single()
    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    if (order.status === "cancelled") return NextResponse.json({ error: "Commande annulée : elle n'est plus modifiable" }, { status: 409 })
    const { error } = await db.from("purchase_orders").update({ notes: notes || null }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ notes: notes || null })
  } catch (err) {
    return errorResponse(err)
  }
}
