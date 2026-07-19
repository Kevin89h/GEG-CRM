import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const SCHEMA = "geg_guinee"
const SECRET = process.env.PUBLIC_LEADS_SECRET

export async function POST(req: NextRequest) {
  // Vérification du secret partagé
  const authHeader = req.headers.get("x-leads-secret")
  if (!SECRET || authHeader !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const {
    name,          // Nom complet ou nom de l'entreprise
    email,
    phone,
    country,
    city,
    message,       // Message ou note du formulaire
    form_type,     // "distributor", "contact", etc.
    source_url,    // URL de la page du formulaire
  } = body

  if (!name || !email) {
    return NextResponse.json({ error: "name and email are required" }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (createAdminClient() as any).schema(SCHEMA)

  // 1. Créer ou retrouver le compte
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

  // 2. Créer l'opportunité (deal)
  const formLabel = form_type === "distributor" ? "Demande distributeur" : "Demande site web"
  const dealTitle = `${formLabel} — ${name.trim()}`

  const notes = [
    message ? `Message : ${message}` : null,
    source_url ? `Source : ${source_url}` : null,
    form_type ? `Formulaire : ${form_type}` : null,
  ].filter(Boolean).join("\n")

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

  return NextResponse.json({ success: true, dealId: deal.id, accountId }, { status: 201 })
}
