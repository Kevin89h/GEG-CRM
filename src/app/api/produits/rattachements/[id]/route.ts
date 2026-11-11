import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse, hasPermission, requirePermission } from "@/lib/access"
import { packagingBlock } from "@/lib/catalog"

// PATCH { action: "validate" } — confirms a proposed link
// PATCH { action: "cancel", reason } — cancels a link (kept in the history); the line can then be linked again.
// The documents are never touched. Needs "Produits : créer" in the active company.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requirePermission("produits.gerer")
    const { id } = await params
    const body = await req.json()
    const { db } = await createCompanyClient()
    const { data: link } = await db.from("historical_line_links").select("id, line_table, line_id, status, note, product:products(name, unit:units(name))").eq("id", id).maybeSingle()
    if (!link) return NextResponse.json({ error: "Correspondance introuvable" }, { status: 404 })
    if (!(await hasPermission(link.line_table === "invoice_lines" ? "factures.voir" : "devis.voir"))) {
      return NextResponse.json({ error: "Votre rôle ou vos permissions ne permettent pas cette action" }, { status: 403 })
    }
    const now = new Date().toISOString()
    let update: Record<string, unknown>
    if (body.action === "validate") {
      if (link.status !== "proposed") return NextResponse.json({ error: "Seule une correspondance proposée peut être validée" }, { status: 409 })
      // packaging rule: unknown or different packaging -> validation refused until the fiche is confirmed
      const { data: line } = await db.from(link.line_table).select("description").eq("id", link.line_id).maybeSingle()
      const prod = Array.isArray(link.product) ? link.product[0] : link.product
      const unit = prod ? (Array.isArray(prod.unit) ? prod.unit[0] : prod.unit)?.name ?? null : null
      const block = packagingBlock(line?.description, prod ? { name: prod.name, unit } : null, link.note)
      if (block) return NextResponse.json({ error: `Validation impossible — ${block}` }, { status: 409 })
      update = { status: "validated", validated_by: access.userId, validated_at: now }
    } else if (body.action === "cancel") {
      const reason = typeof body.reason === "string" ? body.reason.trim() : ""
      if (reason.length < 5) return NextResponse.json({ error: "Indiquez le motif de l'annulation (5 caractères minimum)" }, { status: 400 })
      if (link.status === "cancelled") return NextResponse.json({ error: "Correspondance déjà annulée" }, { status: 409 })
      update = { status: "cancelled", cancelled_by: access.userId, cancelled_at: now, cancel_reason: reason }
    } else {
      return NextResponse.json({ error: "Action inconnue" }, { status: 400 })
    }
    const { data, error } = await db.from("historical_line_links").update(update).eq("id", id).select("id, status").single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    return errorResponse(err)
  }
}
