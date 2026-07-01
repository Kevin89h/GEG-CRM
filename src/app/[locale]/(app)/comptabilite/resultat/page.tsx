import { createCompanyClient } from "@/lib/company"
import ResultatClient from "./ResultatClient"

export default async function ResultatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ year?: string; currency?: string }>
}) {
  const { locale } = await params
  const { year: yearParam, currency: currencyParam } = await searchParams

  const currentYear = new Date().getFullYear()
  const year = parseInt(yearParam ?? String(currentYear))
  const currency = currencyParam ?? "GNF"

  const start = `${year}-01-01`
  const end   = `${year}-12-31`

  const { db } = await createCompanyClient()

  const [
    { data: invoices },
    { data: purchases },
    { data: txCredits },
    { data: txDebits },
  ] = await Promise.all([
    // Ventes clients (CA)
    db.from("invoice_totals")
      .select("id, status, currency, total_ht, issue_date")
      .gte("issue_date", start)
      .lte("issue_date", end)
      .eq("currency", currency)
      .neq("status", "draft")
      .neq("status", "cancelled"),

    // Achats fournisseurs
    db.from("supplier_invoice_totals")
      .select("id, status, currency, total_ht, invoice_date")
      .gte("invoice_date", start)
      .lte("invoice_date", end)
      .eq("currency", currency)
      .neq("status", "draft"),

    // Autres produits (trésorerie entrées hors paiements factures)
    db.from("treasury_transactions")
      .select("id, type, amount, currency, category, description, date")
      .in("type", ["credit", "transfer_in"])
      .gte("date", start + "T00:00:00")
      .lte("date", end + "T23:59:59")
      .eq("currency", currency),

    // Autres charges (trésorerie sorties hors règlements fournisseurs)
    db.from("treasury_transactions")
      .select("id, type, amount, currency, category, description, date")
      .in("type", ["debit", "transfer_out"])
      .gte("date", start + "T00:00:00")
      .lte("date", end + "T23:59:59")
      .eq("currency", currency),
  ])

  return (
    <ResultatClient
      locale={locale}
      year={year}
      currency={currency}
      invoices={invoices ?? []}
      purchases={purchases ?? []}
      txCredits={txCredits ?? []}
      txDebits={txDebits ?? []}
    />
  )
}
