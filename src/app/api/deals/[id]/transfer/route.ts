import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createCompanyClient } from "@/lib/company"

// Transfer Guinée → Singapore
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db, schema } = await createCompanyClient()

  if (schema === "geg_guinee") {
    // Lire le deal depuis Guinée
    const { data: deal, error: dealErr } = await db
      .from("deals")
      .select("*, account:accounts(id, name, email, phone, country, city)")
      .eq("id", id)
      .single()

    if (dealErr || !deal) return NextResponse.json({ error: "Deal introuvable" }, { status: 404 })

    const account = Array.isArray(deal.account) ? deal.account[0] : deal.account
    const admin = createAdminClient()

    // Insérer dans Singapore via RPC
    const { data, error } = await admin.rpc("insert_singapore_lead", {
      p_name: account?.name ?? deal.prospect_name ?? deal.title,
      p_email: account?.email ?? "",
      p_phone: account?.phone ?? null,
      p_country: account?.country ?? null,
      p_city: account?.city ?? null,
      p_deal_title: deal.title,
      p_notes: deal.notes ?? null,
      p_source_url: deal.source_detail ?? null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Supprimer de Guinée
    await db.from("deals").delete().eq("id", id)

    return NextResponse.json({ ok: true, target: "geg_singapore", ...data })
  }

  // Transfer Singapore → Guinée via RPC
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("transfer_singapore_to_guinee", { p_deal_id: id })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, target: "geg_guinee", ...data })
}
