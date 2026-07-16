import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("deals")
    .select("*, account:accounts(id, name, type)")
    .eq("id", id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()

  const allowedFields = [
    "title", "stage", "value", "currency", "probability", "close_date",
    "notes", "priority", "products_requested", "source", "source_detail",
    "assigned_to", "next_action", "next_action_date", "account_id", "prospect_name",
  ]
  const patch: Record<string, unknown> = {}
  for (const k of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k]
  }

  // Fetch previous assigned_to before update
  const { data: before } = await db.from("deals").select("assigned_to, title").eq("id", id).single()

  const { data, error } = await db
    .from("deals")
    .update(patch)
    .eq("id", id)
    .select("*, account:accounts(id, name, type)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notify newly added assignees
  const prevIds: string[] = Array.isArray(before?.assigned_to) ? before.assigned_to : before?.assigned_to ? [before.assigned_to] : []
  const nextIds: string[] = Array.isArray(patch.assigned_to) ? patch.assigned_to as string[] : patch.assigned_to ? [patch.assigned_to as string] : []
  const newlyAdded = nextIds.filter(id => !prevIds.includes(id))
  if (newlyAdded.length > 0) {
    try {
      const supabase = await createClient()
      const { data: emps } = await db.from("employees").select("id, email, profile_id").in("id", newlyAdded)
      for (const emp of emps ?? []) {
        let profileId = emp.profile_id ?? null
        if (!profileId && emp.email) {
          const { data: prof } = await supabase.from("profiles").select("id").eq("email", emp.email).single()
          profileId = prof?.id ?? null
        }
        if (profileId) {
          await supabase.from("notifications").insert([{
            user_id: profileId,
            type: "deal_assigned",
            title: `Nouvelle opportunité assignée`,
            body: `"${before?.title ?? data?.title}" vous a été assignée.`,
            link: `/deals/${id}`,
            read: false,
          }])
        }
      }
    } catch {
      // Notification failure is non-blocking
    }
  }

  return NextResponse.json(data)
}
