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
      assigned_to: body.assigned_to ?? null,
      priority: body.priority ?? "normal",
      value: body.value ?? null,
      currency: body.currency ?? "USD",
      notes: body.notes ?? null,
    }])
    .select("*, account:accounts(id, name)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notify assigned employee if set at creation
  if (body.assigned_to && data) {
    try {
      const { data: emp } = await db.from("employees").select("profile_id").eq("id", body.assigned_to).single()
      if (emp?.profile_id) {
        const supabase = await createClient()
        await supabase.from("notifications").insert([{
          user_id: emp.profile_id,
          type: "deal_assigned",
          title: `Nouvelle opportunité assignée`,
          body: `"${body.title}" vous a été assignée.`,
          link: `/deals/${data.id}`,
          read: false,
        }])
      }
    } catch {
      // Non-blocking
    }
  }

  return NextResponse.json(data)
}
