import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? ""
  const { schema } = await createCompanyClient()
  const db = createAdminClient().schema(schema)

  let query = db.from("accounts").select("id, name").order("name").limit(50)
  if (q) query = query.ilike("name", `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

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

  const validTypes = ["government", "enterprise", "sme", "client", "prospect"]
  const rawType = (body.type ?? "enterprise").toLowerCase()
  const accountType = validTypes.includes(rawType) ? rawType : "enterprise"

  const { data, error } = await db
    .from("accounts")
    .insert([{
      name: body.name,
      type: accountType,
      industry: body.industry ?? null,
      country: body.country ?? null,
      city: body.city ?? null,
      address: body.address ?? null,
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
