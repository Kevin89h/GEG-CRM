import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { logActivity } from "@/lib/activity-logger"
import { currentPerms } from "@/lib/current-perms"
import { LOCKED_MESSAGE, invoiceStatus, invoiceTransitionError } from "@/lib/invoice-lock"

// "notes" is printed on the invoice PDF: draft only (E2). "internal_notes" is never printed: editable at any status.
const ALLOWED_FIELDS = ["notes", "internal_notes", "due_date", "status"]

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

  const current = await invoiceStatus(db, id)
  if (!current) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
  if (("due_date" in update || "notes" in update) && current !== "draft") return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 })
  if ("status" in update) {
    const refused = invoiceTransitionError(await currentPerms(), current, String(update.status))
    if (refused) return NextResponse.json({ error: refused }, { status: 403 })
  }

  update.updated_at = new Date().toISOString()

  const { data, error } = await db
    .from("invoices")
    .update(update)
    .eq("id", id)
    .select("id, number, status, notes, internal_notes")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const label = update.status
    ? `Statut facture ${data.number} → ${update.status}`
    : `Facture ${data.number} modifiée`

  logActivity({ action: "update", resource: "invoice", resourceId: id, label, details: update })

  return NextResponse.json(data)
}
