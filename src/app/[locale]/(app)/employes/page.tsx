import { createCompanyClient } from "@/lib/company"
import EmployesClient from "./EmployesClient"

export default async function EmployesPage() {
  const { db: supabase } = await createCompanyClient()

  const [{ data: employees }, { data: treasury }] = await Promise.all([
    supabase
      .from("employees")
      .select(`
        id, full_name, title, job_description, start_date,
        salary, salary_currency, commission_rate, is_active,
        email, phone, notes,
        commissions(id, amount, currency, rate, status, paid_date, created_at,
          invoice:invoices(number))
      `)
      .order("full_name"),
    supabase.from("treasury_accounts").select("id, name, currency").eq("is_active", true).order("name"),
  ])

  return (
    <EmployesClient
      employees={(employees ?? []).map((e: Record<string, unknown>) => ({
        ...e,
        commissions: Array.isArray(e.commissions) ? e.commissions : [],
      })) as Parameters<typeof EmployesClient>[0]["employees"]}
      treasuryAccounts={(treasury ?? []) as { id: string; name: string; currency: string }[]}
    />
  )
}
