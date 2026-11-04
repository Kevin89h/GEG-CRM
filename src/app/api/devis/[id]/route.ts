import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { logActivity } from "@/lib/activity-logger"

// PATCH: update order fields (status, payment_terms, valid_until, client_order_ref, tva, etc.)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db, schema } = await createCompanyClient()

  // The order date can only change while the quote is neither invoiced nor cancelled
  if ("date_order" in body) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date_order))) {
      return NextResponse.json({ error: "Date de commande invalide" }, { status: 400 })
    }
    const { data: current } = await db.from("sales_orders").select("status").eq("id", id).single()
    if (!current) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })
    if (current.status === "invoiced" || current.status === "cancelled") {
      return NextResponse.json({ error: "La date de commande d'un devis facturé ou annulé ne peut plus être modifiée" }, { status: 400 })
    }
  }

  // An invoiced quote keeps its status; a quote linked to a live invoice can't be cancelled (D2, D6)
  if ("status" in body) {
    const { data: current } = await db.from("sales_orders").select("status").eq("id", id).single()
    if (!current) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })
    if (current.status === "invoiced" && body.status !== "invoiced") {
      return NextResponse.json({ error: "Un devis facturé ne peut plus changer de statut" }, { status: 400 })
    }
    if (body.status === "cancelled") {
      const { count } = await db.from("invoices").select("id", { count: "exact", head: true }).eq("order_id", id).neq("status", "cancelled")
      if (count) return NextResponse.json({ error: "Ce devis a une facture : il ne peut pas être annulé" }, { status: 400 })
    }
  }

  const { data, error } = await db
    .from("sales_orders")
    .update(body)
    .eq("id", id)
    .select("id, status, number, payment_terms, valid_until, client_order_ref, tva")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const label = body.status
    ? `Statut devis ${data.number} → ${body.status}`
    : `Devis ${data.number} modifié`
  logActivity({ action: "update", resource: "devis", resourceId: id, label, details: body })

  return NextResponse.json(data)
}
