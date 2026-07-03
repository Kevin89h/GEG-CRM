import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db } = await createCompanyClient()

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
      is_active: body.is_active ?? true,
    }])
    .select("*, contacts(count), deals(count)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
