import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { logActivity } from "@/lib/activity-logger"

// PATCH: update order fields (status, payment_terms, valid_until, client_order_ref, tva, etc.)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db, schema } = await createCompanyClient()

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
