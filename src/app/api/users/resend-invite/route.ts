import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const { email, role } = await req.json()
    if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: "Clé service non configurée" }, { status: 500 })

    const adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { role: role ?? "user" },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, user: data.user })
  } catch (err) {
    console.error("Resend invite error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
