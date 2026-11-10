import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"
import { deliveryRowsWithComments } from "@/lib/catalog"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lines, userId, accountId } = await req.json()
  const schema = await getCompanySchema()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (createAdminClient() as any).schema(schema)

  const { count } = await db.from("delivery_notes").select("id", { count: "exact", head: true })
  const year = new Date().getFullYear()
  const blNumber = `BL/${year}/${String((count ?? 0) + 1).padStart(5, "0")}`

  const { data: dn, error: dnError } = await db
    .from("delivery_notes")
    .insert([{
      number: blNumber,
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

  // Comment lines (text only, no quantity) are never delivered: the invoice's comments are copied as comments,
  // in their place, with their "Imprimer sur le bon de livraison" choice
  type Row = { product_id: string | null; description: string; quantity: number }
  const deliverable: Row[] = (lines ?? []).filter((l: { line_type?: string | null; product_id?: string | null; quantity?: number }) =>
    l.line_type !== "comment" && !(!l.product_id && Number(l.quantity ?? 0) === 0))
    .map((l: Row) => ({ product_id: l.product_id ?? null, description: l.description, quantity: l.quantity }))
  const { data: source } = await db.from("invoice_lines").select("product_id, description, line_type, print_on_delivery, position").eq("invoice_id", id).order("position")
  const queue = [...deliverable]
  const rows = deliveryRowsWithComments((source ?? []) as { product_id: string | null; description: string; line_type: string | null; print_on_delivery: boolean | null }[], (l) => {
    const i = queue.findIndex(q => q.product_id === l.product_id)
    return i >= 0 ? queue.splice(i, 1)[0] : null
  }, queue)
  if (rows.some(r => !("line_type" in r))) {
    const { error: linesError } = await db.from("delivery_note_lines").insert(
      rows.map(r => ({ line_type: "product", print_on_delivery: true, ...r, delivery_note_id: dn.id }))
    )
    if (linesError) {
      return NextResponse.json({ error: linesError.message }, { status: 400 })
    }
  }

  return NextResponse.json({ deliveryNoteId: dn.id })
}
