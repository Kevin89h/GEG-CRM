import { NextRequest, NextResponse } from "next/server"
import { getSchemaFromRequest } from "@/lib/company"
import { createSchemaClient } from "@/lib/supabase/admin"
import { errorResponse, hasPermission, requirePermission } from "@/lib/access"
import { MANAGER_ROLES, PRODUCT_TYPES, duplicateMessage, findDuplicate, packagingError } from "@/lib/catalog-identity"
import { SENSITIVE, sensitiveFilter } from "@/lib/sensitive"

// GET: active products for pickers (e.g. new purchase order). Purchase price blanked without "produits.prix_achat".
export async function GET(req: NextRequest) {
  try {
    await requirePermission("produits.voir")
    const db = createSchemaClient(await getSchemaFromRequest(req))
    const { data, error } = await db.from("products").select("id, name, reference, buy_price").eq("is_active", true).order("name")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ products: (await sensitiveFilter(SENSITIVE.productInternal)).apply(data ?? []) })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest)  {
  try {
    const access = await requirePermission("produits.gerer")
    const body = await req.json()
    const schema = await getSchemaFromRequest(req)
    const db = createSchemaClient(schema)

    // Product type is a required, explicit choice (R5: services never hold stock; M6: « Remise », never stock, may be negative)
    if (body.product_type !== undefined && !(PRODUCT_TYPES as readonly string[]).includes(body.product_type)) {
      return NextResponse.json({ error: "Type de fiche invalide (marchandise, consommable, prestation ou remise)" }, { status: 400 })
    }
    const productType: string = body.product_type ?? "storable"
    // A4 / M5: one sheet = one packaging (closed list), mandatory for goods; the unit of the sheet is its only unit
    const unitIds = (body.unit_ids as string[] | null)?.filter(Boolean) ?? []
    if (unitIds.length > 1) return NextResponse.json({ error: "Une fiche n'a qu'une seule unité : créez une fiche par conditionnement (ex. 20 L et 200 L)" }, { status: 400 })
    const unitId: string | null = unitIds[0] ?? body.unit_id ?? null
    const identity = {
      name: String(body.name ?? "").trim(), product_type: productType, brand: typeof body.brand === "string" ? body.brand.trim() || null : null,
      packaging: body.packaging || null, packaging_other: typeof body.packaging_other === "string" ? body.packaging_other.trim() || null : null,
      unit_id: unitId, reference: body.reference ?? null,
    }
    if (!identity.name) return NextResponse.json({ error: "Désignation obligatoire" }, { status: 400 })
    const packErr = packagingError(identity)
    if (packErr) return NextResponse.json({ error: packErr }, { status: 400 })
    // A6: server-side anti-duplicate (designation, brand, packaging, unit and type), services and discounts included
    const dup = await findDuplicate(db, identity)
    if (dup) return NextResponse.json({ error: duplicateMessage(dup), duplicate: dup }, { status: 409 })
    // « Autre »: usable only once validated by a Manager or above (a Manager creating it validates it)
    const isManager = MANAGER_ROLES.includes(access.role)
    const packagingStatus = identity.packaging === "Autre" ? (isManager ? "valide" : "a_valider") : identity.packaging ? "valide" : null
    // Purchase price only with "produits.prix_achat" (E5)
    const seeBuy = await hasPermission("produits.prix_achat")

    const ALLOWED_CURRENCIES = ["GNF", "USD", "EUR"]
    const normalizeCurrency = (c: string) => ALLOWED_CURRENCIES.includes(c) ? c : "GNF"

    // Generate next PRD-XXXXX code (GEG Guinée only: the Singapore catalogue has no product code nor unit list)
    const guinee = schema === "geg_guinee"
    const { data: lastCode } = !guinee ? { data: null } : await db
      .from("products")
      .select("product_code")
      .like("product_code", "PRD-%")
      .order("product_code", { ascending: false })
      .limit(1)
      .single()

    const nextNum = lastCode?.product_code
      ? parseInt(lastCode.product_code.replace("PRD-", ""), 10) + 1
      : 1
    const product_code = `PRD-${String(nextNum).padStart(5, "0")}`

    const { data, error } = await db
      .from("products")
      .insert([{
        name: identity.name,
        ...(guinee ? { product_code } : {}),
        product_type: productType,
        reference: body.reference ?? null,
        brand: identity.brand,
        packaging: identity.packaging,
        packaging_other: identity.packaging === "Autre" ? identity.packaging_other : null,
        packaging_status: packagingStatus,
        ...(packagingStatus === "valide" && identity.packaging === "Autre" ? { packaging_validated_by: access.userId, packaging_validated_at: new Date().toISOString() } : {}),
        to_complete: body.to_complete === true,
        missing_info: typeof body.missing_info === "string" && body.missing_info.trim() ? body.missing_info.trim() : null,
        description: body.description ?? null,
        category_id: body.category_id ?? null,
        unit_id: unitId,
        ...(guinee ? { unit_ids: unitId ? [unitId] : null } : {}),
        buy_price: seeBuy ? body.buy_price ?? null : null,
        buy_price_currency: normalizeCurrency(body.buy_price_currency ?? "GNF"),
        sell_price: body.sell_price ?? null,
        currency: normalizeCurrency(body.currency ?? "GNF"),
      }])
      .select("*, category:product_categories(id, name, color), unit:units(id, name, type)")
      .single()

    if (error) {
      const msg = error.message.includes("products_reference_key")
        ? "Une référence identique existe déjà. Laissez le champ vide ou choisissez une référence unique."
        : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json(data)

  } catch (err) {
    return errorResponse(err)
  }
}
