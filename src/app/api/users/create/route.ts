import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const DEFAULT_PERMISSIONS = {
  dashboard:    { view: true,  create: false, edit: false, delete: false },
  accounts:     { view: true,  create: true,  edit: true,  delete: false },
  contacts:     { view: true,  create: true,  edit: true,  delete: false },
  deals:        { view: true,  create: true,  edit: true,  delete: false },
  activities:   { view: true,  create: true,  edit: true,  delete: false },
  ventes:       { view: true,  create: true,  edit: true,  delete: false },
  achats:       { view: true,  create: true,  edit: true,  delete: false },
  stock:        { view: true,  create: true,  edit: true,  delete: false },
  comptabilite: { view: true,  create: false, edit: false, delete: false },
  employes:     { view: true,  create: false, edit: false, delete: false },
  documents:    { view: true,  create: true,  edit: true,  delete: false },
  parametres:   { view: false, create: false, edit: false, delete: false },
}

const ADMIN_PERMISSIONS = Object.fromEntries(
  Object.keys(DEFAULT_PERMISSIONS).map(k => [k, { view: true, create: true, edit: true, delete: true }])
)

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

    const body = await req.json()
    const { email, username, password, full_name, role, phone, job_title } = body

    if (!email && !username) return NextResponse.json({ error: "Email ou pseudo requis" }, { status: 400 })
    if (!password) return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: "Mot de passe minimum 8 caractères" }, { status: 400 })

    // If username provided, generate an internal email
    const authEmail = email?.trim()
      || `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_")}@geg.internal`
    const displayUsername = username?.trim() || null

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: "Configuration manquante" }, { status: 500 })

    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { role: role ?? "user", username: displayUsername },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    await admin.from("profiles").upsert({
      id: newUser.user.id,
      email: authEmail,
      full_name: full_name?.trim() || displayUsername || null,
      phone: phone?.trim() || null,
      job_title: job_title?.trim() || null,
      role: role ?? "user",
      permissions: role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS,
    }, { onConflict: "id" })

    return NextResponse.json({ user: { id: newUser.user.id, email: authEmail, username: displayUsername } })
  } catch (err) {
    console.error("Create user error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
