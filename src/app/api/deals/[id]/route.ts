import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToUser } from "@/lib/webpush"

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
  let nextAssignedIds: string[] = []
  for (const k of allowedFields) {
    if (!Object.prototype.hasOwnProperty.call(body, k)) continue
    if (k === "assigned_to") {
      nextAssignedIds = Array.isArray(body[k]) ? body[k] : body[k] ? [body[k]] : []
      patch[k] = `{${nextAssignedIds.join(",")}}`
    } else {
      patch[k] = body[k]
    }
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
  const prevIds: string[] = Array.isArray(before?.assigned_to) ? before.assigned_to : []
  const newlyAdded = nextAssignedIds.filter(pid => !prevIds.includes(pid))
  if (newlyAdded.length > 0) {
    const supabase = createAdminClient()
    const { error: notifError } = await supabase.from("notifications").insert(
      newlyAdded.map(profileId => ({
        user_id: profileId,
        type: "deal_assigned",
        title: `Nouvelle opportunité assignée`,
        body: `"${before?.title ?? data?.title}" vous a été assignée.`,
        link: `/deals/${id}`,
        read: false,
      }))
    )
    if (notifError) console.error("notifications insert error:", notifError.message)

    const dealTitle = before?.title ?? data?.title ?? "Opportunité"
    await Promise.allSettled(
      newlyAdded.map((pid) =>
        sendPushToUser(pid, {
          title: "Nouvelle opportunité assignée",
          body: `"${dealTitle}" vous a été assignée.`,
          url: `/deals/${id}`,
          tag: `deal-${id}`,
        })
      )
    )
  }

  return NextResponse.json(data)
}
