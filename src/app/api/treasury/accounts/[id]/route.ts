import { NextRequest, NextResponse } from "next/server"
import { createSchemaClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getSchemaFromRequest } from "@/lib/company"
import { AccessError, errorResponse, requireUser } from "@/lib/access"

const SUPER_ADMIN_EMAIL = "kevin@globalenergy.group"

// Security hotfix T1 (16/11/2026): these routes had no access check — any logged-in user could empty the
// transactions of a treasury account ("reset"). Editing: admins and managers. Emptying / purging: the super
// admin only (same rule as the existing purge).
async function requireRoles(roles: string[]) {
  const access = await requireUser()
  if (!roles.includes(access.role)) throw new AccessError(403, "Accès refusé")
  return access
}
async function requireSuperAdminEmail() {
  await requireUser()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", user?.id ?? "").single()
  if (profile?.email !== SUPER_ADMIN_EMAIL) throw new AccessError(403, "Accès refusé : réservé au super administrateur")
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRoles(["admin", "manager"])
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
      // User wants the displayed balance to equal target_balance.
      // balance = initial_balance + total_in - total_out
      // => initial_balance = target_balance - total_in + total_out
      const { data: acc } = await db.from("treasury_accounts").select("total_in, total_out").eq("id", id).single()
      const totalIn = (acc?.total_in ?? 0) as number
      const totalOut = (acc?.total_out ?? 0) as number
      updates.initial_balance = parseFloat(target_balance) - totalIn + totalOut
    } else if (initial_balance !== undefined && initial_balance !== "") {
      updates.initial_balance = parseFloat(initial_balance)
    }

    const { error } = await db.from("treasury_accounts").update(updates).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AccessError) return errorResponse(err)
    console.error("Treasury account update error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// DELETE ?action=reset  → vider les transactions + remettre à 0
// DELETE ?action=purge  → supprimer le compte entier (super admin uniquement)
// Both erase treasury history: super admin only (T1).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdminEmail()
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
    if (err instanceof AccessError) return errorResponse(err)
    console.error("Treasury account delete error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
