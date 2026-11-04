import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireAdmin } from "@/lib/access"
import { assignableRoles, defaultPermissionsFor, isSuperAdmin } from "@/lib/roles"
import { resolveNewUserCompanies } from "../companies"

export async function POST(req: Request) {
  try {
    const actor = await requireAdmin()

    let body: { email?: string; role?: string; company_ids?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
    }

    const { email, company_ids } = body
    const role = body.role ?? "sales_rep"
    if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 })
    if (!assignableRoles(actor.role).includes(role as never)) {
      return NextResponse.json({ error: "Vous ne pouvez pas attribuer ce rôle" }, { status: 403 })
    }
    if (company_ids !== undefined && !isSuperAdmin(actor.role)) {
      return NextResponse.json({ error: "Seul un super admin attribue les sociétés" }, { status: 403 })
    }
    const companies = await resolveNewUserCompanies(actor, company_ids)
    if (companies instanceof NextResponse) return companies

    const adminClient = createAdminClient()

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://crm.gegoil.com"
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { role },
      redirectTo: `${siteUrl}/fr/accept-invite`,
    })

    if (error) {
      console.error("Supabase invite error:", error)
      return NextResponse.json({ error: error.message, code: error.status }, { status: 500 })
    }

    if (data.user) {
      const { error: profileError } = await adminClient.from("profiles").upsert({
        id: data.user.id,
        email,
        role,
        permissions: defaultPermissionsFor(role),
        ...(companies ? { company_access: companies } : {}),
      }, { onConflict: "id" })
      if (profileError) {
        return NextResponse.json({ error: `Invitation envoyée mais profil non enregistré : ${profileError.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, user: data.user })
  } catch (err) {
    console.error("Invite error:", err)
    return errorResponse(err)
  }
}
