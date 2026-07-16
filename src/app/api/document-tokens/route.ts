import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { document_id, document_type } = await req.json()
  if (!document_id || !document_type) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const admin = createAdminClient()
  const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

  // Reuse existing valid token if any
  const { data: existing } = await admin
    .from("document_tokens")
    .select("token")
    .eq("document_id", document_id)
    .eq("document_type", document_type)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (existing?.token) {
    return NextResponse.json({ token: existing.token })
  }

  const { data, error } = await admin
    .from("document_tokens")
    .insert({ document_id, document_type, expires_at })
    .select("token")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token: data.token })
}
