import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireCanManageUser } from "@/lib/access"
import { assignableRoles, isSuperAdmin } from "@/lib/roles"
import { validateCompanyIds } from "../companies"

// PATCH { userId, role, permissions, company_ids? } — company_ids: super admin only
export async function PATCH(req: Request)  {
  try {
    const { userId, role, permissions, company_ids } = await req.json()
    if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 })

    const { actor, target } = await requireCanManageUser(userId)

    const update: Record<string, unknown> = {}
    if (permissions !== undefined) update.permissions = permissions

    if (role !== undefined && role !== target.role) {
      if (userId === actor.userId) {
        return NextResponse.json({ error: "Vous ne pouvez pas changer votre propre rôle" }, { status: 400 })
      }
      if (!assignableRoles(actor.role).includes(role)) {
        return NextResponse.json({ error: "Vous ne pouvez pas attribuer ce rôle" }, { status: 403 })
      }
      update.role = role
    }

    if (company_ids !== undefined) {
      if (!isSuperAdmin(actor.role)) {
        return NextResponse.json({ error: "Seul un super admin attribue les sociétés" }, { status: 403 })
      }
      const companies = await validateCompanyIds(company_ids)
      if (companies instanceof NextResponse) return companies
      update.company_access = companies
    }

    const { error } = await createAdminClient().from("profiles").update(update).eq("id", userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })

  } catch (err) {
    return errorResponse(err)
  }
}
