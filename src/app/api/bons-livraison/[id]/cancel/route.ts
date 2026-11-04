import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// Void of a delivery note BEFORE delivery only (B1); once delivered the stock is out (second chantier).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()
  const { data: dn } = await db.from("delivery_notes").select("status").eq("id", id).single()
  if (!dn) return NextResponse.json({ error: "Bon de livraison introuvable" }, { status: 404 })
  if (dn.status === "delivered") return NextResponse.json({ error: "Bon déjà livré : il ne peut pas être annulé" }, { status: 409 })
  if (dn.status === "cancelled") return NextResponse.json({ ok: true })

  const { error } = await db.from("delivery_notes").update({ status: "cancelled" }).eq("id", id).neq("status", "delivered")
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  return NextResponse.json({ ok: true })
}
