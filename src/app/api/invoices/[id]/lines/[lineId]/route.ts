import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const { id, lineId } = await params
    const body = await req.json()

    const allowed = ["description", "quantity", "unit_price", "discount", "tva_rate"]
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0 && !body.product_id) {
      return NextResponse.json({ error: "Aucun champ valide" }, { status: 400 })
    }

    const { db } = await createCompanyClient()
    // R1: link a free line of a DRAFT invoice to its catalogue sheet (designation, quantity and price unchanged)
    if (typeof body.product_id === "string" && body.product_id) {
      const { data: inv } = await db.from("invoices").select("status").eq("id", id).maybeSingle()
      if (inv?.status !== "draft") return NextResponse.json({ error: "Seule une ligne d'une facture en brouillon peut être rattachée ici" }, { status: 409 })
      const { data: line } = await db.from("invoice_lines").select("product_id").eq("id", lineId).eq("invoice_id", id).maybeSingle()
      if (!line) return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 })
      if (line.product_id) return NextResponse.json({ error: "Cette ligne est déjà rattachée à une fiche" }, { status: 409 })
      const { data: prod } = await db.from("products").select("id, is_active").eq("id", body.product_id).maybeSingle()
      if (!prod?.is_active) return NextResponse.json({ error: "Fiche introuvable ou désactivée" }, { status: 400 })
      updates.product_id = body.product_id
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ valide" }, { status: 400 })
    }
    const { error } = await db.from("invoice_lines").update(updates).eq("id", lineId).eq("invoice_id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
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
