import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()
  const { data, error } = await db
    .from("accounts")
    .update({
      name: body.name,
      phone: body.phone ?? null,
      email: body.email ?? null,
      city: body.city ?? null,
      country: body.country ?? null,
      website: body.website ?? null,
      supplier_currency: body.supplier_currency ?? "USD",
      supplier_notes: body.supplier_notes ?? null,
    })
    .eq("id", id)
    .select("id, name, phone, email, city, country, supplier_currency, supplier_notes")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()
  const { error } = await db.from("accounts").update({ is_supplier: false }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
