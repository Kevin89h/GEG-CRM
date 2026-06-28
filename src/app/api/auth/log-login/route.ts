import { createClient } from "@/lib/supabase/server"
import { logLogin } from "@/lib/activity-logger"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false })
  await logLogin(user.id, user.email ?? "")
  return NextResponse.json({ ok: true })
}
