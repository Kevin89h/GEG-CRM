import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("deals")
    .select("*, account:accounts(id, name, type), assignedEmployee:employees!assigned_to(id, full_name)")
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
    .select("*, account:accounts(id, name, type), assignedEmployee:employees!assigned_to(id, full_name)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notify newly assigned employee if changed
  const newAssignedTo = patch.assigned_to as string | null | undefined
  if (newAssignedTo && newAssignedTo !== before?.assigned_to) {
    try {
      // Find the profile linked to this employee
      const { data: emp } = await db.from("employees").select("profile_id").eq("id", newAssignedTo).single()
      const profileId = emp?.profile_id
      if (profileId) {
        const supabase = await createClient()
        await supabase.from("notifications").insert([{
          user_id: profileId,
          type: "deal_assigned",
          title: `Nouvelle opportunité assignée`,
          body: `"${before?.title ?? data?.title}" vous a été assignée.`,
          link: `/deals/${id}`,
          read: false,
        }])
      }
    } catch {
      // Notification failure is non-blocking
    }
  }

  return NextResponse.json(data)
}
