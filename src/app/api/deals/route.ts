import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db } = await createCompanyClient()

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
      assigned_to: Array.isArray(body.assigned_to) ? body.assigned_to : body.assigned_to ? [body.assigned_to] : null,
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
      const supabase = await createClient()
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
    } catch {
      // Non-blocking
    }
  }

  return NextResponse.json(data)
}
