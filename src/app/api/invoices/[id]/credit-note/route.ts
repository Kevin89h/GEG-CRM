import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { reason } = await req.json() as { reason?: string }
  const { db } = await createCompanyClient()

  const { data: orig, error: origErr } = await db
    .from("invoices")
    .select("number, account_id, currency, due_date, notes, status")
    .eq("id", id)
    .single()

  if (origErr || !orig) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

  if (!["sent", "partial", "paid"].includes(orig.status)) {
    return NextResponse.json({ error: "Une note de crédit ne peut être créée que sur une facture confirmée" }, { status: 400 })
  }

  const { data: origLines } = await db
    .from("invoice_lines")
    .select("description, quantity, unit_price, discount, position, tva_rate, product_id")
    .eq("invoice_id", id)
    .order("position")

  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, "0")
  const { count } = await db.from("invoices").select("*", { count: "exact", head: true }).ilike("number", "AVR-%")
  const seq = String((count ?? 0) + 1).padStart(4, "0")
  const number = `AVR-${year}-${month}-${seq}`

  const noteText = [
    `Avoir sur facture ${orig.number}`,
    reason ? `Motif : ${reason}` : null,
    orig.notes,
  ].filter(Boolean).join("\n")

  const { data: creditNote, error: cnErr } = await db
    .from("invoices")
    .insert([{
      number,
      account_id: orig.account_id,
      currency: orig.currency,
      status: "draft",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: orig.due_date ?? null,
      notes: noteText,
    }])
    .select("id")
    .single()

  if (cnErr || !creditNote) return NextResponse.json({ error: cnErr?.message ?? "Erreur création avoir" }, { status: 500 })

  if (origLines && origLines.length > 0) {
    const cnLines = origLines.map(l => ({
      invoice_id: creditNote.id,
      description: l.description,
      quantity: -(Number(l.quantity)),
      unit_price: Number(l.unit_price),
      discount: Number(l.discount) || 0,
      tva_rate: Number(l.tva_rate) || 0,
      position: l.position,
      product_id: l.product_id ?? null,
    }))

    const { error: lineErr } = await db.from("invoice_lines").insert(cnLines)
    if (lineErr) {
      await db.from("invoices").delete().eq("id", creditNote.id)
      return NextResponse.json({ error: lineErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: creditNote.id, number })
}
