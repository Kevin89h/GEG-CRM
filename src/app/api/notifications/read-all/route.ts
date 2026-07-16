import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false)
  return NextResponse.json({ ok: true })
}
