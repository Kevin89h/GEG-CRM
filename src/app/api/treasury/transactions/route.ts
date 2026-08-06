import { NextRequest, NextResponse } from "next/server"
import { createSchemaClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getSchemaFromRequest } from "@/lib/company"

export async function GET(req: NextRequest) {
  try {
    const db = createSchemaClient(getSchemaFromRequest(req))
    const { data, error } = await db
      .from("treasury_transactions")
      .select("id, account_id, type, amount, currency, description, reference, category, date")
      .order("date", { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ transactions: data ?? [] })
  } catch (err) {
    console.error("Treasury GET error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { account_id, type, amount, currency, description, reference, transfer_account_id, date, category } = body

    if (!account_id || !amount || !description) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })
    }

    // Récupérer l'utilisateur connecté
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const db = createSchemaClient(getSchemaFromRequest(req))
    const isTransfer = type === "transfer_out"

    const rows = [{
      account_id,
      type,
      amount: parseFloat(amount),
      currency: currency ?? "GNF",
      description,
      reference: reference || null,
      category: category || null,
      transfer_account_id: isTransfer ? transfer_account_id : null,
      date: new Date(date).toISOString(),
      user_id: user.id,
    }]

    if (isTransfer && transfer_account_id) {
      rows.push({
        account_id: transfer_account_id,
        type: "transfer_in",
        amount: parseFloat(amount),
        currency: currency ?? "GNF",
        description,
        reference: reference || null,
        category: category || null,
        transfer_account_id: account_id,
        date: new Date(date).toISOString(),
        user_id: user.id,
      })
    }

    const { error } = await db.from("treasury_transactions").insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Treasury transaction error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
