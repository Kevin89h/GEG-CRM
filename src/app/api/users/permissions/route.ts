import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireCanManageUser } from "@/lib/access"
import { assignableRoles, isSuperAdmin } from "@/lib/roles"
import { validateCompanyIds } from "../companies"

// PATCH { userId, role?, company_ids?, dropOverrides?: string[] }
// - role: within assignableRoles (Q3: an admin gives Manager or Commercial only); never one's own role;
// - company_ids: super admin only; exceptions of a removed company are kept, inactive (plan §3.4);
// - dropOverrides: exception ids the administrator chose to remove when changing the role (never silent).
export async function PATCH(req: Request) {
  try {
    const { userId, role, company_ids, dropOverrides } = await req.json()
    if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 })
    const { actor, target } = await requireCanManageUser(userId)

    const update: Record<string, unknown> = {}
    if (role !== undefined && role !== target.role) {
      if (!assignableRoles(actor.role).includes(role)) {
        return NextResponse.json({ error: "Vous ne pouvez pas attribuer ce rôle" }, { status: 403 })
      }
      update.role = role
    }
    if (company_ids !== undefined) {
      if (!isSuperAdmin(actor.role)) return NextResponse.json({ error: "Seul un super admin attribue les sociétés" }, { status: 403 })
      const companies = await validateCompanyIds(company_ids)
      if (companies instanceof NextResponse) return companies
      update.company_access = companies
    }

    const admin = createAdminClient()
    if (Object.keys(update).length) {
      const { error } = await admin.from("profiles").update(update).eq("id", userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (Array.isArray(dropOverrides) && dropOverrides.length) {
      const { error } = await admin.from("user_permission_overrides").delete().eq("user_id", userId).in("id", dropOverrides)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
