import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function PATCH(req: Request) {
  const supabase = await createClient()

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const { userId, role, permissions } = await req.json()
  if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 })

  const { error } = await supabase
    .from("profiles")
    .update({ role, permissions })
    .eq("id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
