import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse, requirePermission } from "@/lib/access"

// Fields of a treasury account that may be edited here (never computed totals nor identifiers)
const EDITABLE = ["name", "type", "institution", "account_number", "swift", "iban", "currency", "color", "is_active", "initial_balance"]

// PATCH: update a treasury account
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("tresorerie.comptes")
    const { id } = await params
    const body = await req.json() as Record<string, unknown>
    const update = Object.fromEntries(Object.entries(body).filter(([k]) => EDITABLE.includes(k)))
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "Aucun champ modifiable" }, { status: 400 })
    const { db } = await createCompanyClient()

    const { data, error } = await db
      .from("treasury_accounts")
      .update(update)
      .eq("id", id)
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    return errorResponse(err)
  }
}

// DELETE: remove a treasury account — only when it has no transaction (history is never deleted:
// an account with movements must be deactivated instead)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("comptes_bancaires.supprimer")
    const { id } = await params
    const { db } = await createCompanyClient()

    const { count, error: countError } = await db.from("treasury_transactions").select("id", { count: "exact", head: true }).eq("account_id", id)
    if (countError || count === null) return NextResponse.json({ error: "Vérification des mouvements impossible : suppression refusée" }, { status: 500 })
    if (count > 0) {
      return NextResponse.json({ error: `Ce compte a ${count} mouvement(s) : il ne peut pas être supprimé. Désactivez-le pour conserver l'historique.` }, { status: 409 })
    }

    const { error } = await db
      .from("treasury_accounts")
      .delete()
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
