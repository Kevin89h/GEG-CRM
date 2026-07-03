import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("contacts")
    .insert([{
      first_name: body.first_name,
      last_name: body.last_name,
      title: body.title ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      account_id: body.account_id ?? null,
      is_primary: body.is_primary ?? false,
      notes: body.notes ?? null,
    }])
    .select("*, account:accounts(id, name, type)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
