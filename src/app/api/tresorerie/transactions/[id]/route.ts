import { NextRequest, NextResponse } from "next/server"
import { getCompanySchema } from "@/lib/company"
import { createClient as createAdminClient } from "@supabase/supabase-js"

async function getAdminDb() {
  const schema = await getCompanySchema()
  const raw = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (raw as any).schema(schema) as typeof raw
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = await getAdminDb()

  const { data, error } = await db
    .from("treasury_transactions")
    .update(body)
    .eq("id", id)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await getAdminDb()

  const { error } = await db.from("treasury_transactions").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
