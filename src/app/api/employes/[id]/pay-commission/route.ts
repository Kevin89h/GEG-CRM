import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// POST: pay a commission — inserts treasury transaction then marks commission paid
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: employeeId } = await params
  void employeeId // not used in DB queries but kept for route consistency
  const body = await req.json()
  const { commissionId, amount, currency, treasury_account_id, paid_date } = body

  if (!commissionId || !treasury_account_id || !paid_date) {
    return NextResponse.json({ error: "commissionId, treasury_account_id and paid_date are required" }, { status: 400 })
  }

  const { db } = await createCompanyClient()

  // Step 1: insert treasury transaction
  const { data: tx, error: txError } = await db
    .from("treasury_transactions")
    .insert([{
      account_id: treasury_account_id,
      type: "debit",
      amount,
      currency,
      description: "Commission employé",
      date: paid_date,
    }])
    .select("id")
    .single()

  if (txError) return NextResponse.json({ error: txError.message }, { status: 400 })

  // Step 2: mark commission paid (only if treasury insert succeeded)
  const { error: commError } = await db
    .from("commissions")
    .update({
      status: "paid",
      paid_date,
      treasury_transaction_id: tx.id,
    })
    .eq("id", commissionId)

  if (commError) return NextResponse.json({ error: commError.message }, { status: 400 })

  return NextResponse.json({ treasury_transaction_id: tx.id })
}
