import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const db = createAdminClient().schema("geg_guinee")

  const { data: accounts, error } = await db
    .from("accounts")
    .select("id, name, type, phone, email, city, country, is_supplier")
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by normalized name (lowercase, trimmed, collapsed spaces)
  const normalize = (s: string) =>
    s.toLowerCase().trim().replace(/\s+/g, " ").replace(/['']/g, "'")

  const groups: Record<string, typeof accounts> = {}
  for (const acc of accounts ?? []) {
    const key = normalize(acc.name)
    if (!groups[key]) groups[key] = []
    groups[key]!.push(acc)
  }

  const duplicateGroups = Object.entries(groups)
    .filter(([, g]) => g.length > 1)
    .map(([key, group]) => ({ key, group }))

  if (duplicateGroups.length === 0) return NextResponse.json({ groups: [] })

  // For each duplicate group, count invoices + sales_orders per account
  const allIds = duplicateGroups.flatMap(({ group }) => group.map((a) => a.id))

  const [{ data: invoiceCounts }, { data: orderCounts }, { data: contactCounts }, { data: dealCounts }] =
    await Promise.all([
      db.from("invoices").select("account_id").in("account_id", allIds),
      db.from("sales_orders").select("account_id").in("account_id", allIds),
      db.from("contacts").select("account_id").in("account_id", allIds),
      db.from("deals").select("account_id").in("account_id", allIds),
    ])

  const countMap = (rows: { account_id: string }[] | null) => {
    const m: Record<string, number> = {}
    for (const r of rows ?? []) m[r.account_id] = (m[r.account_id] ?? 0) + 1
    return m
  }

  const invMap = countMap(invoiceCounts as { account_id: string }[] | null)
  const ordMap = countMap(orderCounts as { account_id: string }[] | null)
  const cntMap = countMap(contactCounts as { account_id: string }[] | null)
  const dealMap = countMap(dealCounts as { account_id: string }[] | null)

  const result = duplicateGroups.map(({ key, group }) => ({
    key,
    accounts: group.map((a) => ({
      ...a,
      invoices: invMap[a.id] ?? 0,
      orders: ordMap[a.id] ?? 0,
      contacts: cntMap[a.id] ?? 0,
      deals: dealMap[a.id] ?? 0,
    })),
  }))

  return NextResponse.json({ groups: result })
}
