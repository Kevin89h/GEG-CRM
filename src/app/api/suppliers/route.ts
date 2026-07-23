import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"

export async function GET() {
  const schema = await getCompanySchema()
  const admin = createAdminClient().schema(schema)
  const { data, error } = await admin
    .from("suppliers")
    .select("id, name, email, phone, country, city, payment_terms, currency, iban, swift, bank_name, notes, is_active")
    .eq("is_active", true)
    .order("name")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ suppliers: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const schema = await getCompanySchema()
  const admin = createAdminClient().schema(schema)
  const { data, error } = await admin
    .from("suppliers")
    .insert([{
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
    }])
    .select("id, name, email, phone, country, city, payment_terms, currency, iban, swift, bank_name, notes, is_active")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
