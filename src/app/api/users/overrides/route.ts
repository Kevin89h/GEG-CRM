import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireCanManageUser } from "@/lib/access"
import { isSuperAdmin } from "@/lib/roles"

// Personal exceptions, per company (decision Q4).
// POST { userId, companyId, permission, effect: "grant" | "deny" | "inherit", reason? } — one permission
// POST { userId, companyId?, reset: true }                                              — back to the role standard
// Rules: the actor must manage the account (Q3) and, for an admin, the company must be one of his own;
// the company must be assigned to the account; reserved prerogatives are never set by exception;
// deletions are never granted to a Commercial (Q2). Every change is recorded by the audit log.
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userId, companyId, permission, effect, reason, reset } = body as {
      userId: string; companyId?: string; permission?: string; effect?: string; reason?: string; reset?: boolean
    }
    if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 })
    const { actor, target } = await requireCanManageUser(userId)

    const targetCompanies: string[] = target.company_access ?? []
    const checkCompany = (id: string) => {
      if (!targetCompanies.includes(id)) return "Cette société n'est pas attribuée à ce compte"
      if (!isSuperAdmin(actor.role) && !actor.companyIds.includes(id)) return "Cette société est hors de votre périmètre"
      return null
    }
    const admin = createAdminClient()

    if (reset) {
      const companies = companyId ? [companyId] : targetCompanies.filter(id => isSuperAdmin(actor.role) || actor.companyIds.includes(id))
      for (const id of companies) {
        const bad = checkCompany(id)
        if (bad) return NextResponse.json({ error: bad }, { status: 403 })
      }
      const { error } = await admin.from("user_permission_overrides").delete().eq("user_id", userId).in("company_id", companies)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (!companyId || !permission || !["grant", "deny", "inherit"].includes(effect ?? "")) {
      return NextResponse.json({ error: "companyId, permission et effect requis" }, { status: 400 })
    }
    const bad = checkCompany(companyId)
    if (bad) return NextResponse.json({ error: bad }, { status: 403 })

    const [{ data: perm }, { data: standard }] = await Promise.all([
      admin.from("permission_catalog").select("key, customizable, grantable_to_sales_rep").eq("key", permission).single(),
      admin.from("role_permissions").select("permission_key").eq("role", target.role).eq("permission_key", permission).maybeSingle(),
    ])
    if (!perm) return NextResponse.json({ error: "Permission inconnue" }, { status: 400 })
    if (!perm.customizable) return NextResponse.json({ error: "Prérogative réservée au rôle : elle ne s'accorde pas par exception" }, { status: 403 })

    // An exception equal to the standard is pointless: store it as "like the role"
    const inStandard = !!standard
    const finalEffect = (effect === "grant" && inStandard) || (effect === "deny" && !inStandard) ? "inherit" : effect
    if (finalEffect === "grant" && target.role === "sales_rep" && !perm.grantable_to_sales_rep) {
      return NextResponse.json({ error: "Cette permission n'est jamais accordée à un Commercial" }, { status: 403 })
    }

    if (finalEffect === "inherit") {
      const { error } = await admin.from("user_permission_overrides").delete()
        .eq("user_id", userId).eq("company_id", companyId).eq("permission_key", permission)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await admin.from("user_permission_overrides").upsert({
        user_id: userId, company_id: companyId, permission_key: permission, effect: finalEffect,
        reason: reason?.trim() || null, created_by: actor.userId, created_at: new Date().toISOString(),
      }, { onConflict: "user_id,permission_key,company_id" })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, effect: finalEffect })
  } catch (err) {
    return errorResponse(err)
  }
}
