import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const { lineId } = await params
    const body = await req.json()

    const allowed = ["description", "quantity", "unit_price", "discount", "tva_rate"]
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ valide" }, { status: 400 })
    }

    const { db } = await createCompanyClient()
    const { error } = await db.from("invoice_lines").update(updates).eq("id", lineId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Invoice line update error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const { lineId } = await params
    const { db } = await createCompanyClient()
    const { error } = await db.from("invoice_lines").delete().eq("id", lineId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Invoice line delete error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
