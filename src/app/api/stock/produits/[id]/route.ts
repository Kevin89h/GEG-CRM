import { NextRequest, NextResponse } from "next/server"
import { getSchemaFromRequest } from "@/lib/company"
import { createSchemaClient } from "@/lib/supabase/admin"
import { errorResponse, hasPermission, requirePermission } from "@/lib/access"
import { MANAGER_ROLES, PRODUCT_TYPES, duplicateMessage, findDuplicate, packagingError } from "@/lib/catalog-identity"

// Fields that make the identity of a sheet (A4 / A6): changing one of them re-runs the packaging and duplicate checks
const IDENTITY = ["name", "brand", "product_type", "packaging", "packaging_other", "unit_id"]

// PATCH — modifies a catalogue sheet (permission "produits.gerer").
// { validate_packaging: true } — a Manager (or above) validates the « Autre » packaging of the sheet (M5).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requirePermission("produits.gerer")
    const { id } = await params
    const body = await req.json()
    const schema = await getSchemaFromRequest(req)
    const db = createSchemaClient(schema)
    const isManager = MANAGER_ROLES.includes(access.role)

    const { data: current } = await db.from("products")
      .select("id, name, brand, product_type, packaging, packaging_other, packaging_status, unit_id, reference").eq("id", id).maybeSingle()
    if (!current) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 })

    if (body.validate_packaging === true) {
      if (!isManager) return NextResponse.json({ error: "Seul un Manager (ou plus) peut valider un conditionnement « Autre »" }, { status: 403 })
      if (current.packaging !== "Autre" || current.packaging_status !== "a_valider") return NextResponse.json({ error: "Aucun conditionnement « Autre » en attente de validation sur cette fiche" }, { status: 409 })
      const { data, error } = await db.from("products")
        .update({ packaging_status: "valide", packaging_validated_by: access.userId, packaging_validated_at: new Date().toISOString() })
        .eq("id", id).eq("packaging_status", "a_valider").select("id, packaging, packaging_other, packaging_status").single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(data)
    }

    const ALLOWED_FIELDS = [
      "name", "reference", "merchant_reference", "description", "category_id", "unit_id",
      "product_type", "can_be_sold", "can_be_purchased",
      "sell_price", "currency", "buy_price", "buy_price_currency",
      "tva_vente", "tva_achat", "barcode", "sku", "origin", "internal_notes", "is_active",
      "brand", "to_complete", "missing_info", "packaging", "packaging_other",
    ]
    const update: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in body) update[key] = body[key]
    }

    // Purchase price and internal references need "produits.prix_achat" (D4); never returned without it
    const seeBuy = await hasPermission("produits.prix_achat")
    if (!seeBuy && ["buy_price", "buy_price_currency", "sku", "internal_notes"].some(k => k in update)) {
      return NextResponse.json({ error: "Vos permissions ne permettent pas de modifier le prix d'achat, le SKU ou les notes internes" }, { status: 403 })
    }

    if (IDENTITY.some(k => k in update)) {
      const next = { ...current, ...update } as { name: string; brand: string | null; product_type: string; packaging: string | null; packaging_other: string | null; unit_id: string | null; reference: string | null }
      if (!(PRODUCT_TYPES as readonly string[]).includes(next.product_type ?? "storable")) {
        return NextResponse.json({ error: "Type de fiche invalide (marchandise, consommable, prestation ou remise)" }, { status: 400 })
      }
      // a sheet that still holds stock cannot become a service or a discount (its stock would disappear from view)
      if ("product_type" in update && ["service", "discount"].includes(String(update.product_type)) && !["service", "discount"].includes(current.product_type ?? "")) {
        const { data: held } = await db.from("stock_levels").select("quantity").eq("product_id", id).neq("quantity", 0).limit(1)
        if ((held ?? []).length) return NextResponse.json({ error: "Cette fiche a encore du stock : elle ne peut pas devenir une prestation ni une remise" }, { status: 409 })
      }
      if (!["storable", "consumable"].includes(next.product_type ?? "storable")) { next.packaging = null; next.packaging_other = null; update.packaging = null; update.packaging_other = null }
      // the packaging is checked when it is set or changed, when the type changes, or once the sheet has one. An OLDER
      // sheet without packaging (362 in Guinée) stays editable (brand, designation…): it is completed progressively,
      // never blocked nor converted automatically (A4)
      const touchesPackaging = "packaging" in update || "packaging_other" in update || ("product_type" in update && update.product_type !== current.product_type)
      if (touchesPackaging || current.packaging) {
        const packErr = packagingError({ ...next, product_type: next.product_type ?? "storable" })
        if (packErr) return NextResponse.json({ error: packErr }, { status: 400 })
      }
      const dup = await findDuplicate(db, { ...next, product_type: next.product_type ?? "storable" }, id)
      if (dup) return NextResponse.json({ error: duplicateMessage(dup), duplicate: dup }, { status: 409 })
      if ("packaging" in update || "packaging_other" in update) {
        if (next.packaging !== "Autre") update.packaging_other = null
        const changed = next.packaging !== current.packaging || (next.packaging === "Autre" && next.packaging_other !== current.packaging_other)
        if (changed) {
          update.packaging_status = next.packaging === "Autre" ? (isManager ? "valide" : "a_valider") : next.packaging ? "valide" : null
          update.packaging_validated_by = next.packaging === "Autre" && isManager ? access.userId : null
          update.packaging_validated_at = next.packaging === "Autre" && isManager ? new Date().toISOString() : null
        }
      }
      if ("unit_id" in update && schema === "geg_guinee") update.unit_ids = update.unit_id ? [update.unit_id] : null
    }

    const { data, error } = await db
      .from("products")
      .update(update)
      .eq("id", id)
      .select("*, category:product_categories(id, name, color), unit:units(id, name, type)")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(seeBuy ? data : { ...data, buy_price: null, sku: null, internal_notes: null })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const schema = await getSchemaFromRequest(_req)
  const db = createSchemaClient(schema)

  const { error } = await db.from("products").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
