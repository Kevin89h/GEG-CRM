import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest) {
  try {
    const { devis_ids } = await req.json() as { devis_ids: string[] }
    if (!Array.isArray(devis_ids) || devis_ids.length === 0)
      return NextResponse.json({ error: "Aucun devis sélectionné" }, { status: 400 })

    const { db } = await createCompanyClient()
    const { error } = await db
      .from("orders")
      .update({ status: "cancelled" })
      .in("id", devis_ids)
      .neq("status", "invoiced")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, count: devis_ids.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
