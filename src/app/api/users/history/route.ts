import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireAdmin, canManageUser, AccessError } from "@/lib/access"
import { isSuperAdmin } from "@/lib/roles"

// GET ?userId= — history of an account's rights: role, companies, blocking, exceptions (audit log)
export async function GET(req: Request) {
  try {
    const actor = await requireAdmin()
    const userId = new URL(req.url).searchParams.get("userId")
    if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 })
    const admin = createAdminClient()
    const { data: target } = await admin.from("profiles").select("id, role, company_access").eq("id", userId).single()
    if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
    if (!isSuperAdmin(actor.role) && !canManageUser(actor, target)) throw new AccessError(403, "Vous ne pouvez pas consulter ce compte")

    const { data: events, error } = await admin.from("audit_events")
      .select("id, occurred_at, actor_id, origin, company, action, old_values, new_values")
      .eq("entity_type", "profile").eq("entity_id", userId)
      .order("occurred_at", { ascending: false }).limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const actorIds = [...new Set((events ?? []).map(e => e.actor_id).filter(Boolean))] as string[]
    const { data: actors } = actorIds.length
      ? await admin.from("profiles").select("id, full_name, email").in("id", actorIds)
      : { data: [] }
    const names = Object.fromEntries((actors ?? []).map(a => [a.id, a.full_name || a.email]))
    return NextResponse.json({ events: (events ?? []).map(e => ({ ...e, actor: e.actor_id ? names[e.actor_id] ?? "?" : "Système" })) })
  } catch (err) {
    return errorResponse(err)
  }
}
