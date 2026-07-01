import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { account_id, type, amount, currency, description, reference, transfer_account_id, date, user_id, category } = body

    if (!account_id || !amount || !description) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })
    }

    const { db } = await createCompanyClient()

    const isTransfer = type === "transfer_out"
    const rows = [{
      account_id, type,
      amount: parseFloat(amount),
      currency: currency ?? "GNF",
      description,
      reference: reference || null,
      category: category || null,
      transfer_account_id: isTransfer ? transfer_account_id : null,
      date: new Date(date).toISOString(),
      user_id: user_id || null,
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
        user_id: user_id || null,
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
