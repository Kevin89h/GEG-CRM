import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST { keepId, deleteId }
// Reassigns all references from deleteId to keepId, then deletes deleteId
export async function POST(req: NextRequest) {
  const { keepId, deleteId } = await req.json()
  if (!keepId || !deleteId) return NextResponse.json({ error: "keepId and deleteId required" }, { status: 400 })
  if (keepId === deleteId) return NextResponse.json({ error: "same id" }, { status: 400 })

  const db = createAdminClient().schema("geg_guinee")

  const tables = [
    { table: "invoices", col: "account_id" },
    { table: "sales_orders", col: "account_id" },
    { table: "contacts", col: "account_id" },
    { table: "deals", col: "account_id" },
    { table: "activities", col: "account_id" },
    { table: "documents", col: "account_id" },
    { table: "delivery_notes", col: "account_id" },
  ]

  for (const { table, col } of tables) {
    const { error } = await db
      .from(table as "invoices")
      .update({ [col]: keepId } as never)
      .eq(col, deleteId)
    if (error && !error.message.includes("does not exist")) {
      return NextResponse.json({ error: `Failed updating ${table}: ${error.message}` }, { status: 500 })
    }
  }

  const { error: delError } = await db.from("accounts").delete().eq("id", deleteId)
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
