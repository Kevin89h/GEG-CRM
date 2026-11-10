import { NextRequest, NextResponse } from "next/server"
import { getSchemaFromRequest } from "@/lib/company"
import { createSchemaClient } from "@/lib/supabase/admin"
import { errorResponse, hasPermission, requirePermission } from "@/lib/access"
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
    await requirePermission("produits.gerer")
    const body = await req.json()
    const schema = await getSchemaFromRequest(req)
    const db = createSchemaClient(schema)

    // Product type is a required, explicit choice (R5: services never hold stock)
    const TYPES = ["storable", "consumable", "service"]
    if (body.product_type !== undefined && !TYPES.includes(body.product_type)) {
      return NextResponse.json({ error: "Type de produit invalide (marchandise, consommable ou service)" }, { status: 400 })
    }
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
        name: body.name,
        ...(guinee ? { product_code } : {}),
        product_type: body.product_type ?? "storable",
        reference: body.reference ?? null,
        brand: typeof body.brand === "string" && body.brand.trim() ? body.brand.trim() : null,
        to_complete: body.to_complete === true,
        missing_info: typeof body.missing_info === "string" && body.missing_info.trim() ? body.missing_info.trim() : null,
        description: body.description ?? null,
        category_id: body.category_id ?? null,
        unit_id: (body.unit_ids as string[] | null)?.length ? body.unit_ids[0] : (body.unit_id ?? null),
        ...(guinee ? { unit_ids: (body.unit_ids as string[] | null)?.length ? body.unit_ids : null } : {}),
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
