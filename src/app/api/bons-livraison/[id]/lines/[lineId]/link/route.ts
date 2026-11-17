import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, hasPermission, requirePermission, requireUser } from "@/lib/access"

// POST { product_id } — links a line of a DRAFT delivery note to its catalogue sheet (regression of 17/11/2026:
// a free line "GEG DIESIEL EXTRA 15W40 200L" was treated as a service and could leave the stock untouched).
// - Only the delivery line is changed (its product_id); the invoice / quote stays as issued (amounts, VAT, PDF).
// - The source free line gets a historical correspondence (decision 6 of 10/11/2026): "validated" when the user holds
//   "produits.gerer", otherwise "proposed" (to be validated in Produits > Rattachements). An existing active
//   correspondence is never replaced here.
// - Stock checks then apply normally at validation (R4), on the warehouse chosen for the line.
// Rights: "livraisons.creer" or "livraisons.confirmer" (also checked by the API rules), active company only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const { id, lineId } = await params
    await requirePermission(["livraisons.creer", "livraisons.confirmer"])
    const { product_id } = await req.json() as { product_id?: string }
    if (!product_id) return NextResponse.json({ error: "Choisissez une fiche du catalogue" }, { status: 400 })

    const { db, schema } = await createCompanyClient()
    const { data: dn } = await db.from("delivery_notes").select("id, number, status, invoice_id, order_id").eq("id", id).single()
    if (!dn) return NextResponse.json({ error: "Bon de livraison introuvable" }, { status: 404 })
    if (dn.status !== "draft") return NextResponse.json({ error: "Seul un bon de livraison en brouillon peut être modifié" }, { status: 409 })
    const { data: line } = await db.from("delivery_note_lines").select("id, description, line_type, product_id").eq("id", lineId).eq("delivery_note_id", id).single()
    if (!line) return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 })
    if (line.line_type === "comment") return NextResponse.json({ error: "Une ligne de commentaire ne se rattache pas au catalogue" }, { status: 400 })
    const { data: product } = await db.from("products").select("id, name, product_type, is_active").eq("id", product_id).single()
    if (!product || !product.is_active) return NextResponse.json({ error: "Fiche introuvable ou désactivée" }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = (createAdminClient() as any).schema(schema)
    const { error: upErr } = await admin.from("delivery_note_lines").update({ product_id }).eq("id", lineId).eq("delivery_note_id", id)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

    // historical correspondence of the source free line (same label), when there is one
    let correspondence: string = "aucune ligne libre d'origine trouvée"
    const sourceTable = dn.invoice_id ? "invoice_lines" : dn.order_id ? "sales_order_lines" : null
    if (sourceTable) {
      const fk = sourceTable === "invoice_lines" ? "invoice_id" : "order_id"
      const { data: src } = await admin.from(sourceTable).select("id, description").eq(fk, dn.invoice_id ?? dn.order_id).is("product_id", null)
      const s = ((src ?? []) as { id: string; description: string }[]).find(x => (x.description ?? "").trim() === (line.description ?? "").trim())
      if (s) {
        const { data: existing } = await admin.from("historical_line_links").select("id, status, product_id").eq("line_table", sourceTable).eq("line_id", s.id).neq("status", "cancelled").maybeSingle()
        if (existing) {
          correspondence = existing.product_id === product_id ? `correspondance existante (${existing.status === "validated" ? "validée" : "proposée"})` : "une autre correspondance existe déjà : à vérifier dans Produits > Rattachements"
        } else {
          const user = await requireUser()
          const validated = await hasPermission("produits.gerer")
          const now = new Date().toISOString()
          const { error: linkErr } = await admin.from("historical_line_links").insert([{
            line_table: sourceTable, line_id: s.id, product_id, status: validated ? "validated" : "proposed", source: "manual",
            note: `Rattachée depuis le bon de livraison ${dn.number}`, created_by: user.userId,
            ...(validated ? { validated_by: user.userId, validated_at: now } : {}),
          }])
          correspondence = linkErr ? `correspondance non enregistrée : ${linkErr.message}` : validated ? "correspondance validée" : "correspondance proposée (à valider)"
        }
      }
    }
    return NextResponse.json({ ok: true, product: { id: product.id, name: product.name, product_type: product.product_type }, correspondence })
  } catch (err) {
    return errorResponse(err)
  }
}
