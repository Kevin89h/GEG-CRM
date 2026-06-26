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
  const supabase = await createClient()

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const { email, role } = await req.json()
  if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 })

  // Use service role key for admin operations
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { role },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create profile for the invited user
  if (data.user) {
    await adminClient.from("profiles").upsert({
      id: data.user.id,
      email,
      role,
      permissions: role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS,
    }, { onConflict: "id" })
  }

  return NextResponse.json({ success: true, user: data.user })
}
