import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"
import { errorResponse, requireSchemaAccess } from "@/lib/access"

// POST { product_id } — links a line of a DRAFT delivery note to its catalogue sheet (targeted fix ANO-001, 18/11/2026).
// Only the delivery line changes (its catalogue sheet); the invoice / quote stays as issued (label, amounts, VAT, PDF).
// The stock check then applies normally when the delivery note is confirmed (R4).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const { id, lineId } = await params
    const schema = await getCompanySchema()
    await requireSchemaAccess(schema)
    const { product_id } = await req.json() as { product_id?: string }
    if (!product_id) return NextResponse.json({ error: "Choisissez une fiche du catalogue" }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (createAdminClient() as any).schema(schema)
    const { data: dn } = await db.from("delivery_notes").select("id, status").eq("id", id).single()
    if (!dn) return NextResponse.json({ error: "Bon de livraison introuvable" }, { status: 404 })
    if (dn.status !== "draft") return NextResponse.json({ error: "Seul un bon de livraison en brouillon peut être modifié" }, { status: 409 })
    const { data: line } = await db.from("delivery_note_lines").select("id").eq("id", lineId).eq("delivery_note_id", id).single()
    if (!line) return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 })
    const { data: product } = await db.from("products").select("id, name, product_type, is_active").eq("id", product_id).single()
    if (!product || !product.is_active) return NextResponse.json({ error: "Fiche introuvable ou désactivée" }, { status: 400 })

    const { error } = await db.from("delivery_note_lines").update({ product_id }).eq("id", lineId).eq("delivery_note_id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, product: { id: product.id, name: product.name, product_type: product.product_type } })
  } catch (err) {
    return errorResponse(err)
  }
}
