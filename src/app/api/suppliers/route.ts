import { NextRequest, NextResponse } from "next/server"
import { createSchemaClient, createAdminClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"

export async function GET(req: NextRequest) {
  try {
    const schema = getSchemaFromRequest(req)

    if (schema === "geg_singapore") {
      const admin = createAdminClient()
      const { data, error } = await admin.rpc("get_singapore_suppliers")
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ suppliers: data ?? [] })
    }

    const admin = createSchemaClient(schema)
    const { data, error } = await admin
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
    const schema = getSchemaFromRequest(req)

    if (schema === "geg_singapore") {
      const admin = createAdminClient()
      const { data, error } = await admin.rpc("insert_singapore_supplier", {
        p_name: body.name,
        p_email: body.email ?? null,
        p_phone: body.phone ?? null,
        p_country: body.country ?? null,
        p_city: body.city ?? null,
        p_address: body.address ?? null,
        p_payment_terms: body.payment_terms ?? null,
        p_currency: body.currency ?? "USD",
        p_iban: body.iban ?? null,
        p_swift: body.swift ?? null,
        p_bank_name: body.bank_name ?? null,
        p_notes: body.notes ?? null,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      const row = Array.isArray(data) ? data[0] : data
      return NextResponse.json(row)
    }

    const admin = createSchemaClient(schema)
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
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
