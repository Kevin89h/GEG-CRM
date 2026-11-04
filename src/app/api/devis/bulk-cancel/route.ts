import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse } from "@/lib/access"
import { logActivity } from "@/lib/activity-logger"

// POST { devis_ids } — cancels the selected quotes (decision D6).
// A quote already invoiced (status "invoiced", or linked to an invoice that is not cancelled) is never
// cancelled. Cancelling only changes the status: lines, history and links are kept.
export async function POST(req: NextRequest) {
  try {
    const { devis_ids } = await req.json() as { devis_ids: string[] }
    if (!Array.isArray(devis_ids) || devis_ids.length === 0)
      return NextResponse.json({ error: "Aucun devis sélectionné" }, { status: 400 })

    const { db } = await createCompanyClient()

    const [{ data: orders, error: readErr }, { data: invoices }] = await Promise.all([
      db.from("sales_orders").select("id, number, status").in("id", devis_ids),
      db.from("invoices").select("order_id").in("order_id", devis_ids).neq("status", "cancelled"),
    ])
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })

    const invoiced = new Set((invoices ?? []).map(i => i.order_id))
    const cancellable = (orders ?? []).filter(o => o.status !== "invoiced" && o.status !== "cancelled" && !invoiced.has(o.id))
    const skipped = (orders ?? []).filter(o => !cancellable.includes(o)).map(o => o.number)

    if (cancellable.length > 0) {
      const { error } = await db
        .from("sales_orders")
        .update({ status: "cancelled" })
        .in("id", cancellable.map(o => o.id))
        .not("status", "in", "(invoiced,cancelled)")
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      for (const o of cancellable) {
        logActivity({ action: "cancel", resource: "devis", resourceId: o.id, label: `Devis ${o.number} annulé (annulation groupée)` })
      }
    }

    return NextResponse.json({ success: true, count: cancellable.length, skipped })
  } catch (err) {
    return errorResponse(err)
  }
}
