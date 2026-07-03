import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lines, userId, accountId } = await req.json()
  const { db } = await createCompanyClient()

  const { data: dn, error: dnError } = await db
    .from("delivery_notes")
    .insert([{
      number: "",
      invoice_id: id,
      account_id: accountId ?? null,
      status: "draft",
      user_id: userId,
    }])
    .select("id")
    .single()

  if (dnError || !dn) {
    return NextResponse.json({ error: dnError?.message ?? "Failed to create delivery note" }, { status: 400 })
  }

  if (lines && lines.length > 0) {
    const { error: linesError } = await db.from("delivery_note_lines").insert(
      lines.map((l: { product_id: string | null; description: string; quantity: number }, i: number) => ({
        delivery_note_id: dn.id,
        product_id: l.product_id ?? null,
        description: l.description,
        quantity: l.quantity,
        position: i,
      }))
    )
    if (linesError) {
      return NextResponse.json({ error: linesError.message }, { status: 400 })
    }
  }

  return NextResponse.json({ deliveryNoteId: dn.id })
}
