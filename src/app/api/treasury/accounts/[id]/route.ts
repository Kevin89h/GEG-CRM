import { NextRequest, NextResponse } from "next/server"
import { createSchemaClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"
import { errorResponse, requirePermission, requireSuperAdmin } from "@/lib/access"

// amounts are numeric(…, 2): compute in whole cents so that the adjusted balance is exactly the one asked for
const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // treasury account managers, or document settings managers (bank details printed on documents)
    await requirePermission(["tresorerie.comptes", "parametres.gerer"])
    const { id } = await params
    const body = await req.json()
    const { name, type, institution, account_number, swift, iban, currency, initial_balance, target_balance } = body

    if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 })

    const db = createSchemaClient(await getSchemaFromRequest(req))
    const updates: Record<string, unknown> = {
      name, type,
      institution: institution || null,
      account_number: account_number || null,
      swift: swift || null,
      iban: iban || null,
      currency,
    }

    if (target_balance !== undefined && target_balance !== "") {
      // A3: the displayed balance must become exactly target_balance.
      // balance = initial_balance + total_in - total_out, with total_in / total_out computed from the REAL
      // treasury transactions (treasury_balances view) — never from stored columns (absent in Guinée, 0 in
      // Singapour). Only initial_balance changes: no transaction is created, changed or duplicated.
      const target = Number(target_balance)
      if (!Number.isFinite(target)) return NextResponse.json({ error: "Solde demandé invalide" }, { status: 400 })
      const { data: acc, error: accErr } = await db.from("treasury_balances").select("total_in, total_out").eq("id", id).maybeSingle()
      if (accErr) return NextResponse.json({ error: accErr.message }, { status: 400 })
      if (!acc) return NextResponse.json({ error: "Compte introuvable dans cette société" }, { status: 404 })
      updates.initial_balance = (cents(target) - cents(acc.total_in) + cents(acc.total_out)) / 100
    } else if (initial_balance !== undefined && initial_balance !== "") {
      updates.initial_balance = parseFloat(initial_balance)
    }

    const { error } = await db.from("treasury_accounts").update(updates).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

// DELETE ?action=reset  → vider les transactions + remettre à 0
// DELETE ?action=purge  → supprimer le compte entier
// Both erase treasury history: super admins only (by role, no longer by a hard-coded e-mail). Before, "reset"
// was open to any logged-in user. Whether these actions should exist at all is a GEG decision.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const action = searchParams.get("action") ?? "reset"
    const db = createSchemaClient(await getSchemaFromRequest(req))

    if (action === "purge") {
      // Supprimer les transactions puis le compte
      await db.from("treasury_transactions").delete().eq("account_id", id)
      const { error } = await db.from("treasury_accounts").delete().eq("id", id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, deleted: true })
    }

    // action === "reset" : vider les transactions + solde à 0
    const { error: txErr } = await db.from("treasury_transactions").delete().eq("account_id", id)
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

    const { error: accErr } = await db.from("treasury_accounts").update({ initial_balance: 0 }).eq("id", id)
    if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
