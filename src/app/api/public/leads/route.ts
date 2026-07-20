import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendLeadNotification } from "@/lib/notify"

const SCHEMA_GUINEE = "geg_guinee"

const SECRET = process.env.PUBLIC_LEADS_SECRET

const GUINEE_COUNTRIES = ["Guinée", "Guinee", "Guinea", "GN"]

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-leads-secret",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

function isGuinee(country: string | null | undefined): boolean {
  if (!country) return true
  return GUINEE_COUNTRIES.some(c => country.trim().toLowerCase() === c.toLowerCase())
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("x-leads-secret")
  if (!SECRET || authHeader !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS })
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

  // Parse "Name <email@domain.com>" format (Gmail sends this in from.value / raw from field)
  const fromRaw = typeof email === "string" ? email : ""
  const emailMatch = fromRaw.match(/<([^>]+)>/)
  const cleanEmail = emailMatch ? emailMatch[1].trim() : fromRaw.trim()
  const extractedName = emailMatch ? fromRaw.slice(0, fromRaw.indexOf("<")).trim().replace(/^"|"$/g, "") : ""
  const resolvedName = name?.trim() || extractedName || cleanEmail

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return NextResponse.json({ error: "email is required" }, { status: 400, headers: CORS_HEADERS })
  }

  const formLabel = form_type === "distributor" ? "Demande distributeur" : form_type === "email" ? "Demande via email" : "Demande site web"
  const dealTitle = `${formLabel} — ${resolvedName}`
  const notes = [
    message ? `Message : ${message}` : null,
    source_url ? `Source : ${source_url}` : null,
    form_type ? `Formulaire : ${form_type}` : null,
  ].filter(Boolean).join("\n")

  // Leads non-Guinée ou emails entrants → geg_singapore
  if (!isGuinee(country) || form_type === "email") {
    const db = createAdminClient()
    const { data, error } = await db.rpc("insert_singapore_lead", {
      p_name: resolvedName,
      p_email: cleanEmail.trim(),
      p_phone: phone ?? null,
      p_country: country ?? null,
      p_city: city ?? null,
      p_deal_title: dealTitle,
      p_notes: notes || null,
      p_source_url: source_url ?? null,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: CORS_HEADERS })
    }

    sendLeadNotification({
      name: resolvedName,
      email: cleanEmail,
      phone: phone ?? null,
      country: country ?? null,
      message: message ?? null,
      dealTitle,
      company: "geg_singapore",
      source: source_url ?? form_type ?? "website",
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      dealId: (data as { deal_id: string }).deal_id,
      accountId: (data as { account_id: string }).account_id,
      company: "geg_singapore",
    }, { status: 201, headers: CORS_HEADERS })
  }

  // Leads Guinée → geg_guinee via schema routing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (createAdminClient() as any).schema(SCHEMA_GUINEE)

  let accountId: string | null = null

  const { data: existingAccount } = await db
    .from("accounts")
    .select("id")
    .ilike("email", cleanEmail.trim())
    .maybeSingle()

  if (existingAccount) {
    accountId = existingAccount.id
  } else {
    const { data: newAccount, error: accountError } = await db
      .from("accounts")
      .insert([{
        name: resolvedName,
        type: "enterprise",
        email: cleanEmail.trim(),
        phone: phone ?? null,
        country: country ?? null,
        city: city ?? null,
      }])
      .select("id")
      .single()

    if (accountError) {
      return NextResponse.json({ error: accountError.message }, { status: 400, headers: CORS_HEADERS })
    }
    accountId = newAccount.id
  }

  const { data: deal, error: dealError } = await db
    .from("deals")
    .insert([{
      title: dealTitle,
      account_id: accountId,
      prospect_name: resolvedName,
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
    return NextResponse.json({ error: dealError.message }, { status: 400, headers: CORS_HEADERS })
  }

  sendLeadNotification({
    name: resolvedName,
    email: cleanEmail,
    phone: phone ?? null,
    country: country ?? null,
    message: message ?? null,
    dealTitle,
    company: "geg_guinee",
    source: source_url ?? form_type ?? "website",
  }).catch(() => {})

  return NextResponse.json({ success: true, dealId: deal.id, accountId, company: SCHEMA_GUINEE }, { status: 201, headers: CORS_HEADERS })
}
