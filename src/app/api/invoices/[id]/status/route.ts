import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { status } = await req.json()

    const allowed = ["draft", "sent", "partial", "paid", "cancelled"]
    if (!allowed.includes(status)) return NextResponse.json({ error: "Statut invalide" }, { status: 400 })

    const { db } = await createCompanyClient()
    const { error } = await db.from("invoices").update({ status }).eq("id", id)

    // a business refusal of the database (e.g. M4 purchase check at emission) is a 409 with its precise message
    if (error) return NextResponse.json({ error: error.message }, { status: error.hint === "GEG_REFUS" ? 409 : 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Invoice status error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
