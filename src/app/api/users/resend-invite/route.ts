import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireCanManageUser } from "@/lib/access"

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 })

    const adminClient = createAdminClient()
    const { data: target } = await adminClient.from("profiles").select("id, role").eq("email", email).single()
    if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
    await requireCanManageUser(target.id)

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { role: target.role },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, user: data.user })
  } catch (err) {
    console.error("Resend invite error:", err)
    return errorResponse(err)
  }
}
