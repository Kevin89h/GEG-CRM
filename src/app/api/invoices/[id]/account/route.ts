import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { account_id } = await req.json()

  if (!account_id) return NextResponse.json({ error: "account_id requis" }, { status: 400 })

  const { db } = await createCompanyClient()
  const { error } = await db.from("invoices").update({ account_id }).eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
