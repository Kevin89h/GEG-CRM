import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const userId   = searchParams.get("user_id")
  const resource = searchParams.get("resource")
  const action   = searchParams.get("action")
  const from     = searchParams.get("from")
  const to       = searchParams.get("to")
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit    = 50

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = admin
    .schema("geg_guinee")
    .from("activity_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (userId)   query = query.eq("user_id", userId)
  if (resource) query = query.eq("resource", resource)
  if (action)   query = query.eq("action", action)
  if (from)     query = query.gte("created_at", from)
  if (to)       query = query.lte("created_at", to)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch last login per user from auth.users via admin API
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 200 })
  const lastLogins: Record<string, string> = {}
  for (const u of authUsers?.users ?? []) {
    if (u.last_sign_in_at) lastLogins[u.id] = u.last_sign_in_at
  }

  return NextResponse.json({ logs: data, total: count ?? 0, lastLogins })
}
