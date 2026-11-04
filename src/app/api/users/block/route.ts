import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireCanManageUser } from "@/lib/access"
import { logActivity } from "@/lib/activity-logger"

// POST { userId, blocked } — blocks or reactivates an account (D7).
// The account, its role, its companies and its whole history are kept.
// Effect is immediate: the middleware, the server and the database rules (has_company_access)
// all refuse a blocked profile, even with a session still open; the Supabase ban stops new sign-ins.
export async function POST(req: Request) {
  try {
    const { userId, blocked } = await req.json()
    if (!userId || typeof blocked !== "boolean") {
      return NextResponse.json({ error: "userId et blocked requis" }, { status: 400 })
    }

    const { actor, target } = await requireCanManageUser(userId)
    if (userId === actor.userId) {
      return NextResponse.json({ error: "Vous ne pouvez pas bloquer votre propre compte" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from("profiles")
      .update({
        is_blocked: blocked,
        blocked_at: blocked ? new Date().toISOString() : null,
        blocked_by: blocked ? actor.userId : null,
      })
      .eq("id", userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: blocked ? "876000h" : "none",
    })
    if (banError) return NextResponse.json({ error: banError.message }, { status: 500 })

    await logActivity({
      action: "update",
      resource: "user",
      resourceId: userId,
      label: `${blocked ? "Compte bloqué" : "Compte réactivé"} : ${target.email}`,
      details: { blocked },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
