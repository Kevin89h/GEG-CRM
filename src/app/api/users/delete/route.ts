import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireCanManageUser, requireSuperAdmin } from "@/lib/access"

export async function DELETE(req: Request) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 })

    // Accounts are blocked, not deleted, so that their history stays linked (D7).
    // Deletion stays possible for a super admin only, for accounts created by mistake.
    await requireSuperAdmin()
    const { actor } = await requireCanManageUser(userId)
    if (userId === actor.userId) return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 })

    const adminClient = createAdminClient()
    await adminClient.from("profiles").delete().eq("id", userId)
    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Delete user error:", err)
    return errorResponse(err)
  }
}
