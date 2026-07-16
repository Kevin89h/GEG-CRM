import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("deals")
    .insert([{
      title: body.title,
      account_id: body.account_id ?? null,
      prospect_name: body.prospect_name ?? null,
      stage: body.stage ?? "lead",
      source: body.source ?? "other",
      source_detail: body.source_detail ?? null,
      products_requested: body.products_requested ?? null,
      assigned_to: body.assigned_to ?? null,
      priority: body.priority ?? "normal",
      value: body.value ?? null,
      currency: body.currency ?? "USD",
      notes: body.notes ?? null,
    }])
    .select("*, account:accounts(id, name)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
