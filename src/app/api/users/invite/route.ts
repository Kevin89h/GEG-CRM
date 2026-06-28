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

    // Check admin role — allow if no profile found (first user scenario)
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    let body: { email?: string; role?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
    }

    const { email, role } = body
    if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: "Clé service non configurée" }, { status: 500 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    )

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://crm.gegoil.com"
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { role: role ?? "member" },
      redirectTo: `${siteUrl}/fr/accept-invite`,
    })

    if (error) {
      console.error("Supabase invite error:", error)
      return NextResponse.json({ error: error.message, code: error.status }, { status: 500 })
    }

    if (data.user) {
      await adminClient.from("profiles").upsert({
        id: data.user.id,
        email,
        role: role ?? "member",
        permissions: role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS,
      }, { onConflict: "id" })
    }

    return NextResponse.json({ success: true, user: data.user })
  } catch (err) {
    console.error("Invite error:", err)
    return NextResponse.json({ error: "Erreur serveur inattendue" }, { status: 500 })
  }
}
