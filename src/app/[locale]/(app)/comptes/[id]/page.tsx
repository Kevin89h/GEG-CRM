import { createCompanyClient } from "@/lib/company"
import { notFound } from "next/navigation"
import AccountDetailClient from "./AccountDetailClient"

export default async function AccountDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db: supabase } = await createCompanyClient()

  const [{ data: account }, { data: orders }, { data: invoices }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, type, industry, country, city, phone, email, salesperson:employees(full_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("sales_orders")
      .select(`
        id, number, status, currency, created_at,
        salesperson:employees(full_name),
        lines:sales_order_lines(quantity, unit_price, discount)
      `)
      .eq("account_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoice_totals")
      .select("id, number, status, currency, issue_date, due_date, balance, total_paid, total_ht")
      .eq("account_id", id)
      .order("issue_date", { ascending: false }),
  ])

  const invoiceIds = (invoices ?? []).map((i: Record<string, unknown>) => i.id as string)
  const { data: payments } = invoiceIds.length > 0
    ? await supabase
        .from("payments")
        .select("id, amount, currency, paid_at, notes, invoice:invoices(number)")
        .in("invoice_id", invoiceIds)
        .order("paid_at", { ascending: false })
    : { data: [] }

  if (!account) notFound()

  // Compute order totals from lines
  const ordersWithTotal = (orders ?? []).map((o: Record<string, unknown>) => {
    const lines = (Array.isArray(o.lines) ? o.lines : []) as { quantity: number; unit_price: number; discount: number }[]
    const total = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100), 0)
    const sp = Array.isArray(o.salesperson) ? o.salesperson[0] : o.salesperson
    return {
      id: o.id as string,
      number: o.number as string,
      status: o.status as string,
      currency: o.currency as string,
      created_at: o.created_at as string,
      total,
      salesperson: sp as { full_name: string } | null,
    }
  })

  const invoicesData = (invoices ?? []).map((i: Record<string, unknown>) => ({
    id: i.id as string,
    number: i.number as string,
    status: i.status as string,
    currency: i.currency as string,
    issue_date: i.issue_date as string,
    due_date: i.due_date as string | null,
    total: Number(i.total_ht),
    total_paid: Number(i.total_paid),
    balance: Number(i.balance),
  }))

  const acct = account as Record<string, unknown>
  const sp = Array.isArray(acct.salesperson) ? acct.salesperson[0] : acct.salesperson

  const paymentsData = (payments ?? []).map((p: Record<string, unknown>) => {
    const inv = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice
    return {
      id: p.id as string,
      amount: Number(p.amount) || 0,
      currency: p.currency as string,
      paid_at: p.paid_at as string,
      notes: p.notes as string | null,
      invoice_number: (inv as Record<string, string> | null)?.number ?? null,
    }
  })

  return (
    <AccountDetailClient
      account={{
        id: acct.id as string,
        name: acct.name as string,
        type: acct.type as string,
        industry: acct.industry as string | null,
        country: acct.country as string,
        city: acct.city as string | null,
        phone: acct.phone as string | null,
        email: acct.email as string | null,
        salesperson: sp as { full_name: string } | null,
      }}
      orders={ordersWithTotal}
      invoices={invoicesData}
      payments={paymentsData}
      locale={locale}
    />
  )
}
