import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { logActivity } from "@/lib/activity-logger"

const ALLOWED_FIELDS = ["notes", "due_date", "status"]

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()

  const update: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data, error } = await db
    .from("invoices")
    .update(update)
    .eq("id", id)
    .select("id, number, status, notes")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  logActivity({ action: "update", resource: "invoice", resourceId: id, label: `Facture ${data.number} modifiée`, details: update })

  return NextResponse.json(data)
}
