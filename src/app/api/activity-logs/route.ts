import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const resource = req.nextUrl.searchParams.get("resource")
  const resourceId = req.nextUrl.searchParams.get("resourceId")

  if (!resource || !resourceId) {
    return NextResponse.json({ error: "resource et resourceId requis" }, { status: 400 })
  }

  const admin = getAdmin()
  const { data, error } = await admin
    .schema("geg_guinee")
    .from("activity_logs")
    .select("id, action, label, user_name, user_email, details, created_at")
    .eq("resource", resource)
    .eq("resource_id", resourceId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
