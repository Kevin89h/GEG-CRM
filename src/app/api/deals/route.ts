import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToUser } from "@/lib/webpush"
import { sendLeadNotification } from "@/lib/notify"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db, schema } = await createCompanyClient()

  // Singapore schema not accessible via PostgREST — use RPC
  if (schema === "geg_singapore") {
    const admin = createAdminClient()
    const { data: sgData, error: sgError } = await admin.rpc("insert_singapore_lead", {
      p_name: body.prospect_name ?? body.title ?? "—",
      p_email: body.email ?? "",
      p_phone: body.phone ?? null,
      p_country: body.country ?? null,
      p_city: body.city ?? null,
      p_deal_title: body.title,
      p_notes: body.notes ?? null,
      p_source_url: body.source_detail ?? null,
    })
    if (sgError) return NextResponse.json({ error: sgError.message }, { status: 400 })
    sendLeadNotification({
      name: body.prospect_name ?? body.title ?? "—",
      email: body.email ?? "",
      phone: body.phone ?? null,
      country: body.country ?? null,
      message: body.notes ?? null,
      dealTitle: body.title,
      company: "geg_singapore",
      source: body.source ?? "crm-manual",
    }).catch(() => {})
    return NextResponse.json(sgData)
  }

  const { data, error } = await db
    .from("deals")
    .insert([{
      title: body.title,
      account_id: body.account_id ?? null,
      prospect_name: body.prospect_name ?? null,
      stage: body.stage ?? "lead",
      source: body.source ?? "other",
      source_detail: body.source_detail ?? null,
      products_requested: body.products_requested ?? null,
      assigned_to: (() => { const a: string[] = Array.isArray(body.assigned_to) ? body.assigned_to : body.assigned_to ? [body.assigned_to] : []; return `{${a.join(",")}}` })(),
      priority: body.priority ?? "normal",
      value: body.value ?? null,
      currency: body.currency ?? "USD",
      notes: body.notes ?? null,
    }])
    .select("*, account:accounts(id, name)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notify assigned users (assigned_to stores profile IDs directly)
  const assignedIds: string[] = Array.isArray(body.assigned_to) ? body.assigned_to : body.assigned_to ? [body.assigned_to] : []
  if (assignedIds.length > 0 && data) {
    try {
      const supabase = createAdminClient()
      await supabase.from("notifications").insert(
        assignedIds.map(profileId => ({
          user_id: profileId,
          type: "deal_assigned",
          title: `Nouvelle opportunité assignée`,
          body: `"${body.title}" vous a été assignée.`,
          link: `/deals/${data.id}`,
          read: false,
        }))
      )
      await Promise.allSettled(
        assignedIds.map((pid) =>
          sendPushToUser(pid, {
            title: "Nouvelle opportunité assignée",
            body: `"${body.title}" vous a été assignée.`,
            url: `/deals/${data.id}`,
            tag: `deal-${data.id}`,
          })
        )
      )
    } catch {
      // Non-blocking
    }
  }

  if (data) {
    sendLeadNotification({
      name: data.prospect_name ?? data.title ?? "—",
      email: (data.account as any)?.email ?? "",
      phone: null,
      country: null,
      message: body.notes ?? null,
      dealTitle: data.title,
      company: schema === "geg_singapore" ? "geg_singapore" : "geg_guinee",
      source: body.source ?? "crm-manual",
    }).catch(() => {})
  }

  return NextResponse.json(data)
}
