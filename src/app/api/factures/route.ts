import { invalidSalesLines, lineKind } from "@/lib/catalog"
import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { logActivity } from "@/lib/activity-logger"
import { errorResponse } from "@/lib/access"
import { currentPerms } from "@/lib/current-perms"
import { invoiceTransitionError } from "@/lib/invoice-lock"

interface InvoiceLine {
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  discount: number
  position: number
  tva_rate: number
}

export async function POST(req: NextRequest)  {
  try {
    const body = await req.json()
    const { invoice: invoiceData, lines, user_id } = body as {
      invoice: Record<string, unknown>
      lines: InvoiceLine[]
      user_id: string
    }

    const { db, schema } = await createCompanyClient()
    // R1 / R2: every line is an active product or service of the catalogue
    const invalid = await invalidSalesLines(db, lines ?? [])
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const issueDate = invoiceData.issue_date ? new Date(invoiceData.issue_date as string) : new Date()
    const year = issueDate.getFullYear()
    const month = String(issueDate.getMonth() + 1).padStart(2, "0")
    const { count } = await db.from("invoices").select("*", { count: "exact", head: true })
    const seq = String((count ?? 0) + 1).padStart(4, "0")
    const number = `FAC-${year}-${month}-${seq}`

    // Lines can only be written on a draft: create as draft, emit afterwards if asked
    const requestedStatus = (invoiceData.status as string | undefined) ?? "draft"
    const { data: invoice, error: invErr } = await db.from("invoices").insert([{
      ...invoiceData,
      status: "draft",
      number,
      user_id,
    }]).select("id").single()

    if (invErr || !invoice) return NextResponse.json({ error: invErr?.message ?? "Erreur création facture" }, { status: 400 })

    if (lines.length > 0) {
      const { error: lineErr } = await db.from("invoice_lines").insert(
        lines.map(l => ({ ...l, ...lineKind(l), invoice_id: invoice.id }))
      )
      if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 400 })
    }

    if (requestedStatus !== "draft") {
      const refused = invoiceTransitionError(await currentPerms(), "draft", requestedStatus)
      if (refused) return NextResponse.json({ error: refused, id: invoice.id }, { status: 403 })
      const { error: stErr } = await db.from("invoices").update({ status: requestedStatus }).eq("id", invoice.id)
      if (stErr) return NextResponse.json({ error: stErr.message }, { status: 400 })
    }

    logActivity({ action: "create", resource: "invoice", resourceId: invoice.id, label: `Facture ${number} créée`, details: { number } })
    return NextResponse.json({ id: invoice.id })

  } catch (err) {
    return errorResponse(err)
  }
}
