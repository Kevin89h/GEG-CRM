import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db, schema } = await createCompanyClient()

  // Singapore schema not accessible via PostgREST — use RPC
  if (schema === "geg_singapore") {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("insert_singapore_account", {
      p_name: body.name,
      p_type: body.type ?? "enterprise",
      p_industry: body.industry ?? null,
      p_country: body.country ?? null,
      p_city: body.city ?? null,
      p_phone: body.phone ?? null,
      p_email: body.email ?? null,
      p_website: body.website ?? null,
      p_notes: body.notes ?? null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  const { data, error } = await db
    .from("accounts")
    .insert([{
      name: body.name,
      type: body.type ?? "enterprise",
      industry: body.industry ?? null,
      country: body.country ?? null,
      city: body.city ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      website: body.website ?? null,
      notes: body.notes ?? null,
      salesperson_id: body.salesperson_id ?? null,
    }])
    .select("*, contacts(count), deals(count)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
