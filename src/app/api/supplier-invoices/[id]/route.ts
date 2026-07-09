import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()
  const { data, error } = await db
    .from("supplier_invoices")
    .update(body)
    .eq("id", id)
    .select("id, status")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()

  // Vérifier qu'il n'y a pas de paiements avant suppression
  const { count } = await db
    .from("supplier_payments")
    .select("id", { count: "exact", head: true })
    .eq("supplier_invoice_id", id)

  if ((count ?? 0) > 0)
    return NextResponse.json({ error: "Impossible de supprimer une facture avec des paiements enregistrés." }, { status: 400 })

  const { error } = await db.from("supplier_invoices").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
