import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireCanManageUser, requireSuperAdmin } from "@/lib/access"

export async function DELETE(req: Request) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 })

    // Accounts are blocked, not deleted, so that their history stays (plan §8).
    // Deletion stays possible for a super admin only, for an account created by mistake.
    await requireSuperAdmin()
    const { actor } = await requireCanManageUser(userId)
    if (userId === actor.userId) return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 })

    const adminClient = createAdminClient()
    // The database refuses to delete a profile that has history (protect_profile_history): the account must be
    // blocked instead, so that its name stays on everything it created, validated or changed.
    const { error: profileError } = await adminClient.from("profiles").delete().eq("id", userId)
    if (profileError) {
      const hasHistory = /historique/i.test(profileError.message)
      return NextResponse.json({ error: hasHistory ? "Ce compte a un historique : il ne peut pas être supprimé. Bloquez-le : son accès est coupé et son nom reste sur ses opérations." : profileError.message }, { status: hasHistory ? 409 : 500 })
    }
    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Delete user error:", err)
    return errorResponse(err)
  }
}
