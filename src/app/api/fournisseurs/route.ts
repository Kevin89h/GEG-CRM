import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function GET() {
  const { db } = await createCompanyClient()
  const { data, error } = await db
    .from("accounts")
    .select("id, name, phone, email, city, country, supplier_currency, supplier_notes")
    .eq("is_supplier", true)
    .order("name")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fournisseurs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db } = await createCompanyClient()
  const { data, error } = await db
    .from("accounts")
    .insert([{
      name: body.name,
      type: "enterprise",
      is_supplier: true,
      phone: body.phone ?? null,
      email: body.email ?? null,
      city: body.city ?? null,
      country: body.country ?? null,
      website: body.website ?? null,
      supplier_currency: body.supplier_currency ?? "USD",
      supplier_notes: body.supplier_notes ?? null,
    }])
    .select("id, name, phone, email, city, country, supplier_currency, supplier_notes")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
