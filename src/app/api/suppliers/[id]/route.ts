import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const schema = await getCompanySchema()
  const admin = createAdminClient().schema(schema)
  const { data, error } = await admin
    .from("suppliers")
    .update({
      name: body.name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      country: body.country ?? null,
      city: body.city ?? null,
      address: body.address ?? null,
      payment_terms: body.payment_terms ?? null,
      currency: body.currency ?? "USD",
      iban: body.iban ?? null,
      swift: body.swift ?? null,
      bank_name: body.bank_name ?? null,
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, name, email, phone, country, city, payment_terms, currency, iban, swift, bank_name, notes, is_active")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const schema = await getCompanySchema()
  const admin = createAdminClient().schema(schema)
  const { error } = await admin
    .from("suppliers")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
