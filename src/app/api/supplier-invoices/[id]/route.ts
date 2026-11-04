import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { currentPerms } from "@/lib/current-perms"
import { allows } from "@/lib/permissions"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()
  // Void before validation and without payment only (B1); other changes need "factures_fournisseurs.gerer"
  const perms = await currentPerms()
  if (body.status === "cancelled") {
    if (!allows(perms, "factures_fournisseurs.annuler")) return NextResponse.json({ error: "Vos permissions ne permettent pas d'annuler cette facture" }, { status: 403 })
    const [{ data: cur }, { count }] = await Promise.all([
      db.from("supplier_invoices").select("status").eq("id", id).single(),
      db.from("supplier_payments").select("id", { count: "exact", head: true }).eq("supplier_invoice_id", id),
    ])
    if (count || !["draft", "pending"].includes(cur?.status ?? ""))
      return NextResponse.json({ error: "Facture validée ou payée : elle ne peut pas être annulée (corriger par un avoir)" }, { status: 409 })
  } else if (!allows(perms, "factures_fournisseurs.gerer")) {
    return NextResponse.json({ error: "Vos permissions ne permettent pas de modifier cette facture" }, { status: 403 })
  }
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
