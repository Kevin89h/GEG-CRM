import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { guard, requireSchemaAccess } from "@/lib/access"

export async function GET()  {
  const denied = await guard(() => requireSchemaAccess("geg_singapore"))
  if (denied) return denied
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("get_singapore_deals")
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
