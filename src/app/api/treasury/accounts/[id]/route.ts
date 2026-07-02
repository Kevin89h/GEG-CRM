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
  return { db: (admin as any).schema(schema) as typeof admin, schema }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, type, institution, account_number, currency, initial_balance, target_balance } = body

    if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 })

    const { db } = await getAdminDb()
    const updates: Record<string, unknown> = {
      name, type,
      institution: institution || null,
      account_number: account_number || null,
      currency,
    }

    if (target_balance !== undefined && target_balance !== "") {
      // User wants the displayed balance to equal target_balance.
      // balance = initial_balance + total_in - total_out
      // => initial_balance = target_balance - total_in + total_out
      const { data: acc } = await db.from("treasury_accounts").select("total_in, total_out").eq("id", id).single()
      const totalIn = (acc?.total_in ?? 0) as number
      const totalOut = (acc?.total_out ?? 0) as number
      updates.initial_balance = parseFloat(target_balance) - totalIn + totalOut
    } else if (initial_balance !== undefined && initial_balance !== "") {
      updates.initial_balance = parseFloat(initial_balance)
    }

    const { error } = await db.from("treasury_accounts").update(updates).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Treasury account update error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// Reset: delete all transactions + set initial_balance = 0
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { db } = await getAdminDb()

    // Delete all transactions for this account
    const { error: txErr } = await db.from("treasury_transactions").delete().eq("account_id", id)
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

    // Reset initial_balance to 0
    const { error: accErr } = await db.from("treasury_accounts").update({ initial_balance: 0 }).eq("id", id)
    if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Treasury account reset error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
