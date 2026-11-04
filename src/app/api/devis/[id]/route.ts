import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { logActivity } from "@/lib/activity-logger"
import { currentPerms } from "@/lib/current-perms"
import { allows } from "@/lib/permissions"

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

  // Status changes need their own permission; an invoiced quote keeps its status (D2, Q2)
  if ("status" in body) {
    const perms = await currentPerms()
    const need = body.status === "cancelled" ? "devis.annuler" : body.status === "confirmed" ? "devis.confirmer" : "devis.modifier"
    if (!allows(perms, need)) return NextResponse.json({ error: "Vos permissions ne permettent pas cette action" }, { status: 403 })
    if (body.status === "invoiced") return NextResponse.json({ error: "Le statut Facturé est donné par la création de la facture" }, { status: 400 })
    const { data: current } = await db.from("sales_orders").select("status").eq("id", id).single()
    if (!current) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })
    const { count } = await db.from("invoices").select("id", { count: "exact", head: true }).eq("order_id", id).neq("status", "cancelled")
    if (count) return NextResponse.json({ error: "Ce devis a une facture : son statut ne peut plus changer" }, { status: 400 })
  } else if (!allows(await currentPerms(), "devis.modifier")) {
    return NextResponse.json({ error: "Vos permissions ne permettent pas de modifier ce devis" }, { status: 403 })
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
