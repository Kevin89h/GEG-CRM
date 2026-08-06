import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }).schema("geg_guinee") as any
}

export async function GET() {
  try {
    const { data, error } = await adminDb()
      .from("suppliers")
      .select("id, name, email, phone, country, city, payment_terms, currency, iban, swift, bank_name, notes, is_active")
      .eq("is_active", true)
      .order("name")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ suppliers: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, error } = await adminDb()
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
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
