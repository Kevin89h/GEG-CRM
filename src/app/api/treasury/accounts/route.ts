import { NextRequest, NextResponse } from "next/server"
import { createSchemaClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"

export async function GET(req: NextRequest) {
  try {
    const db = createSchemaClient(getSchemaFromRequest(req))
    const { data, error } = await db
      .from("treasury_accounts")
      .select("id, name, institution, account_number, swift, iban, currency, type, is_active")
      .eq("type", "bank")
      .order("currency")
      .order("institution")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ accounts: data ?? [] })
  } catch (err) {
    console.error("Treasury accounts GET error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, type, institution, account_number, swift, iban, currency, initial_balance, color } = body

    if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 })

    const db = createSchemaClient(getSchemaFromRequest(req))
    const { data, error } = await db.from("treasury_accounts").insert([{
      name,
      type: type ?? "bank",
      institution: institution || null,
      account_number: account_number || null,
      swift: swift || null,
      iban: iban || null,
      currency: currency ?? "GNF",
      initial_balance: parseFloat(initial_balance) || 0,
      color: color ?? "blue",
      is_active: true,
    }]).select("*").single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ account: data })
  } catch (err) {
    console.error("Treasury account error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
