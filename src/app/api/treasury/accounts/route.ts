import { createClient as createAdminClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

async function getAdminDb() {
  const cookieStore = await cookies()
  const schema = cookieStore.get("geg_company")?.value ?? "geg_guinee"
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (admin as any).schema(schema) as typeof admin
}

export async function GET() {
  try {
    const db = await getAdminDb()
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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, type, institution, account_number, swift, iban, currency, initial_balance, color } = body

    if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 })

    const db = await getAdminDb()
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
