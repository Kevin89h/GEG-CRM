import { createClient } from "@/lib/supabase/server"
import { logLogin } from "@/lib/activity-logger"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST()  {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false })
    await logLogin(user.id, user.email ?? "")
    await createAdminClient().rpc("audit_log_event", {
      p_company: null, p_module: "acces", p_action: "connexion", p_entity_type: "profile",
      p_entity_id: user.id, p_label: user.email ?? null, p_details: null,
    })
    return NextResponse.json({ ok: true })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
