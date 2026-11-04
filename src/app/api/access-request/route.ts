import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireUser } from "@/lib/access"
import { NAV_ITEMS } from "@/lib/navigation"
import { roleLabel } from "@/lib/roles"
import { sendPushToUser } from "@/lib/webpush"
import messages from "../../../../messages/fr.json"

// POST { module } — notifies the super admins that the user asks for access to a menu item.
// At most one request per user and module every 24 hours.
export async function POST(req: Request) {
  try {
    const actor = await requireUser()
    const { module } = await req.json()
    const item = NAV_ITEMS.find(i => i.key === module)
    if (!item) return NextResponse.json({ error: "Module inconnu" }, { status: 400 })

    const admin = createAdminClient()
    const link = `/parametres/utilisateurs?demande=${actor.userId}&module=${item.key}`

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("type", "access_request")
      .eq("link", link)
      .gte("created_at", since)
    if (count) return NextResponse.json({ already: true })

    // Super admins receive the requests; admins only while no super admin exists yet
    const { data: superAdmins } = await admin.from("profiles").select("id").eq("role", "super_admin")
    const { data: recipients } = superAdmins?.length
      ? { data: superAdmins }
      : await admin.from("profiles").select("id").eq("role", "admin")
    if (!recipients?.length) return NextResponse.json({ error: "Aucun destinataire" }, { status: 500 })

    const [{ data: requester }, { data: companies }] = await Promise.all([
      admin.from("profiles").select("full_name, email").eq("id", actor.userId).single(),
      admin.from("companies").select("name").in("id", actor.companyIds),
    ])
    const who = requester?.full_name || requester?.email || "Un utilisateur"
    const label = (messages.nav as Record<string, string>)[item.key] ?? item.key
    const title = `Demande d'accès : ${label}`
    const body = `${who} (${roleLabel(actor.role)}, ${(companies ?? []).map(c => c.name).join(" + ") || "aucune société"}) demande l'accès à « ${label} ».`

    const { error } = await admin.from("notifications").insert(
      recipients.map(r => ({ user_id: r.id, type: "access_request", title, body, link, read: false }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await Promise.allSettled(recipients.map(r => sendPushToUser(r.id, { title, body, url: link, tag: `access-${actor.userId}-${item.key}` })))

    return NextResponse.json({ sent: recipients.length })
  } catch (err) {
    return errorResponse(err)
  }
}
