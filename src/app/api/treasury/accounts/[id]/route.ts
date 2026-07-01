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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, type, institution, account_number, currency, initial_balance } = body

    if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 })

    const db = await getAdminDb()
    const updates: Record<string, unknown> = {
      name, type,
      institution: institution || null,
      account_number: account_number || null,
      currency,
    }
    if (initial_balance !== undefined && initial_balance !== "") {
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
