import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendPushToUser } from "@/lib/webpush"

export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const db = admin.schema("geg_guinee")
  const today = new Date().toISOString().slice(0, 10)

  // Invoices due today or overdue, not yet fully paid
  const { data: invoices } = await db
    .from("invoices")
    .select("id, number, due_date, user_id, account:accounts(name)")
    .in("status", ["sent", "partial", "open"])
    .lte("due_date", today)
    .not("user_id", "is", null)

  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 })
  }

  const dueToday = invoices.filter((inv) => inv.due_date === today)
  const overdue = invoices.filter((inv) => inv.due_date < today)

  const notifications: { user_id: string; type: string; title: string; body: string; link: string }[] = []

  for (const inv of dueToday) {
    if (!inv.user_id) continue
    const client = (inv.account as { name?: string } | null)?.name ?? "Client"
    notifications.push({
      user_id: inv.user_id,
      type: "invoice_due",
      title: "Facture à encaisser aujourd'hui",
      body: `${inv.number} — ${client} arrive à échéance aujourd'hui.`,
      link: `/ventes/factures/${inv.id}`,
    })
  }

  for (const inv of overdue) {
    if (!inv.user_id) continue
    const client = (inv.account as { name?: string } | null)?.name ?? "Client"
    const days = Math.floor((new Date().getTime() - new Date(inv.due_date).getTime()) / 86400000)
    notifications.push({
      user_id: inv.user_id,
      type: "invoice_overdue",
      title: `Facture en retard de ${days} jour${days > 1 ? "s" : ""}`,
      body: `${inv.number} — ${client} est impayée depuis ${days} jour${days > 1 ? "s" : ""}.`,
      link: `/ventes/factures/${inv.id}`,
    })
  }

  // Insert in-app notifications (batch)
  if (notifications.length > 0) {
    await admin.from("notifications").insert(
      notifications.map((n) => ({ ...n, read: false }))
    )
  }

  // Send web push
  await Promise.allSettled(
    notifications.map((n) =>
      sendPushToUser(n.user_id, {
        title: n.title,
        body: n.body,
        url: n.link,
        tag: `invoice-${n.link.split("/").pop()}`,
      })
    )
  )

  return NextResponse.json({ ok: true, notified: notifications.length })
}
