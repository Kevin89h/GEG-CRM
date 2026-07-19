import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const SCHEMA_GUINEE = "geg_guinee"

const SECRET = process.env.PUBLIC_LEADS_SECRET

const GUINEE_COUNTRIES = ["Guinée", "Guinee", "Guinea", "GN"]

function isGuinee(country: string | null | undefined): boolean {
  if (!country) return true
  return GUINEE_COUNTRIES.some(c => country.trim().toLowerCase() === c.toLowerCase())
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("x-leads-secret")
  if (!SECRET || authHeader !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const {
    name,
    email,
    phone,
    country,
    city,
    message,
    form_type,
    source_url,
  } = body

  if (!name || !email) {
    return NextResponse.json({ error: "name and email are required" }, { status: 400 })
  }

  const formLabel = form_type === "distributor" ? "Demande distributeur" : "Demande site web"
  const dealTitle = `${formLabel} — ${name.trim()}`
  const notes = [
    message ? `Message : ${message}` : null,
    source_url ? `Source : ${source_url}` : null,
    form_type ? `Formulaire : ${form_type}` : null,
  ].filter(Boolean).join("\n")

  // Leads non-Guinée → geg_singapore via RPC (schema non exposé directement)
  if (!isGuinee(country)) {
    const db = createAdminClient()
    const { data, error } = await db.rpc("insert_singapore_lead", {
      p_name: name.trim(),
      p_email: email.trim(),
      p_phone: phone ?? null,
      p_country: country ?? null,
      p_city: city ?? null,
      p_deal_title: dealTitle,
      p_notes: notes || null,
      p_source_url: source_url ?? null,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      dealId: (data as { deal_id: string }).deal_id,
      accountId: (data as { account_id: string }).account_id,
      company: "geg_singapore",
    }, { status: 201 })
  }

  // Leads Guinée → geg_guinee via schema routing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (createAdminClient() as any).schema(SCHEMA_GUINEE)

  let accountId: string | null = null

  const { data: existingAccount } = await db
    .from("accounts")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle()

  if (existingAccount) {
    accountId = existingAccount.id
  } else {
    const { data: newAccount, error: accountError } = await db
      .from("accounts")
      .insert([{
        name: name.trim(),
        type: "enterprise",
        email: email.trim(),
        phone: phone ?? null,
        country: country ?? null,
        city: city ?? null,
      }])
      .select("id")
      .single()

    if (accountError) {
      return NextResponse.json({ error: accountError.message }, { status: 400 })
    }
    accountId = newAccount.id
  }

  const { data: deal, error: dealError } = await db
    .from("deals")
    .insert([{
      title: dealTitle,
      account_id: accountId,
      prospect_name: name.trim(),
      stage: "lead",
      source: "website",
      source_detail: source_url ?? null,
      products_requested: null,
      assigned_to: "{}",
      priority: "normal",
      notes: notes || null,
    }])
    .select("id, title")
    .single()

  if (dealError) {
    return NextResponse.json({ error: dealError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, dealId: deal.id, accountId, company: SCHEMA_GUINEE }, { status: 201 })
}
