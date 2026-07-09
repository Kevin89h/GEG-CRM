import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params
  const { db } = await createCompanyClient()

  const { error: delErr } = await db.from("payments").delete().eq("id", paymentId).eq("invoice_id", id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

  // Recalcul du solde et mise à jour du statut
  const { data: remaining } = await db.from("payments").select("amount").eq("invoice_id", id)
  const { data: inv } = await db.from("invoices").select("id").eq("id", id).single()
  if (!inv) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

  const totalPaid = (remaining ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const newStatus = totalPaid <= 0 ? "sent" : "partial"
  await db.from("invoices").update({ status: newStatus }).eq("id", id)

  return NextResponse.json({ ok: true, totalPaid, newStatus })
}
