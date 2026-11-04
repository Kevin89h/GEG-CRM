import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"
import { errorResponse } from "@/lib/access"
import { currentPerms } from "@/lib/current-perms"
import { invoiceStatus, invoiceTransitionError } from "@/lib/invoice-lock"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { status } = await req.json()

    const allowed = ["draft", "sent", "partial", "paid", "cancelled"]
    if (!allowed.includes(status)) return NextResponse.json({ error: "Statut invalide" }, { status: 400 })

    const { db } = await createCompanyClient()
    const current = await invoiceStatus(db, id)
    if (!current) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
    const refused = invoiceTransitionError(await currentPerms(), current, status)
    if (refused) return NextResponse.json({ error: refused }, { status: 403 })

    const { error } = await db.from("invoices").update({ status }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
