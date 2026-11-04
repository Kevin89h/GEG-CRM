import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireCanManageUser } from "@/lib/access"

// POST { userId, blocked } — blocks or reactivates an account (section 8 of the plan).
// The profile, its role, companies, exceptions and whole history are kept. The effect is immediate:
// the middleware, the server and the database rules refuse a blocked profile even with a session open,
// and the Supabase ban stops new sign-ins. The audit log records author, date, before → after.
export async function POST(req: Request) {
  try {
    const { userId, blocked } = await req.json()
    if (!userId || typeof blocked !== "boolean") {
      return NextResponse.json({ error: "userId et blocked requis" }, { status: 400 })
    }
    const { actor } = await requireCanManageUser(userId)

    const admin = createAdminClient()
    const { error } = await admin.from("profiles").update({
      is_blocked: blocked,
      blocked_at: blocked ? new Date().toISOString() : null,
      blocked_by: blocked ? actor.userId : null,
    }).eq("id", userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: blocked ? "876000h" : "none" })
    if (banError) return NextResponse.json({ error: banError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
