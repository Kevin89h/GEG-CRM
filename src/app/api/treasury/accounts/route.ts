import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, type, institution, account_number, currency, initial_balance, color } = body

    if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 })

    const { db } = await createCompanyClient()

    const { data, error } = await db.from("treasury_accounts").insert([{
      name,
      type: type ?? "bank",
      institution: institution || null,
      account_number: account_number || null,
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
