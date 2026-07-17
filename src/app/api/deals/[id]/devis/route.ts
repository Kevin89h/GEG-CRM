import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

type Params = { params: Promise<{ id: string }> }

// GET: list devis linked to this deal
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("sales_orders")
    .select("id, number, status, total_ttc, currency, created_at, account:accounts(id, name)")
    .eq("deal_id", id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

// POST: link an existing devis to this deal
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { devis_id } = await req.json()
  const { supabase, db } = await createCompanyClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await db
    .from("sales_orders")
    .update({ deal_id: id })
    .eq("id", devis_id)
    .select("id, number, status, total_ttc, currency, created_at, account:accounts(id, name)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE: unlink a devis from this deal
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { devis_id } = await req.json()
  const { supabase, db } = await createCompanyClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await db
    .from("sales_orders")
    .update({ deal_id: null })
    .eq("id", devis_id)
    .eq("deal_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
