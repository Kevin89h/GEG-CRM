import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireAdmin } from "@/lib/access"
import { assignableRoles, defaultPermissionsFor, isSuperAdmin } from "@/lib/roles"
import { resolveNewUserCompanies } from "../companies"

export async function POST(req: Request) {
  try {
    const actor = await requireAdmin()

    const body = await req.json()
    const { email, username, password, full_name, phone, job_title, company_ids } = body
    const role: string = body.role ?? "sales_rep"

    if (!email && !username) return NextResponse.json({ error: "Email ou pseudo requis" }, { status: 400 })
    if (!password) return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: "Mot de passe minimum 8 caractères" }, { status: 400 })
    if (!assignableRoles(actor.role).includes(role as never)) {
      return NextResponse.json({ error: "Vous ne pouvez pas attribuer ce rôle" }, { status: 403 })
    }
    if (company_ids !== undefined && !isSuperAdmin(actor.role)) {
      return NextResponse.json({ error: "Seul un super admin attribue les sociétés" }, { status: 403 })
    }
    const companies = await resolveNewUserCompanies(actor, company_ids)
    if (companies instanceof NextResponse) return companies

    // If username provided, generate an internal email
    const authEmail = email?.trim()
      || `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_")}@geg.internal`
    const displayUsername = username?.trim() || null

    const admin = createAdminClient()

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { role, username: displayUsername, phone: phone?.trim() || null, job_title: job_title?.trim() || null },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: newUser.user.id,
      email: authEmail,
      full_name: full_name?.trim() || displayUsername || null,
      role,
      permissions: defaultPermissionsFor(role),
      ...(companies ? { company_access: companies } : {}),
    }, { onConflict: "id" })

    if (profileError) {
      return NextResponse.json({ error: `Compte créé mais profil non enregistré : ${profileError.message}` }, { status: 500 })
    }

    return NextResponse.json({ user: { id: newUser.user.id, email: authEmail, username: displayUsername } })
  } catch (err) {
    console.error("Create user error:", err)
    return errorResponse(err)
  }
}
