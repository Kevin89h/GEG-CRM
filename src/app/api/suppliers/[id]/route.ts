import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }).schema("geg_guinee") as any
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { data, error } = await adminDb()
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
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { error } = await adminDb()
      .from("suppliers")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
