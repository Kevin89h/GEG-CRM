import { hasPermission } from "@/lib/access"
import { SENSITIVE, sensitiveFilter } from "@/lib/sensitive"
import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import EmployesClient from "./EmployesClient"

export default async function EmployesPage() {
  const { db: supabase } = await createCompanyClient()
  const authClient = await createClient()

  // Salaries (E4) and commissions are removed on the server for users without the permission
  const [salary, canCommissions] = await Promise.all([sensitiveFilter(SENSITIVE.salary), hasPermission("commissions.gerer")])
  const [{ data: employees }, { data: treasury }, { data: profiles }] = await Promise.all([
    supabase
      .from("employees")
      .select(`
        id, full_name, title, job_description, start_date,
        salary, salary_currency, commission_rate, is_active,
        email, phone, notes, profile_id,
        commissions(id, amount, currency, rate, status, paid_date, created_at,
          invoice:invoices(number))
      `)
      .order("full_name"),
    supabase.from("treasury_accounts").select("id, name, currency").eq("is_active", true).order("name"),
    authClient.from("profiles").select("id, full_name, email").order("full_name"),
  ])

  return (
    <EmployesClient
      employees={(employees ?? []).map((e: Record<string, unknown>) => ({
        ...salary.apply(e),
        // Commission amounts: "commissions.gerer" only (filtered on the server)
        commissions: canCommissions && Array.isArray(e.commissions) ? e.commissions : [],
      })) as Parameters<typeof EmployesClient>[0]["employees"]}
      canSeeSalaries={salary.allowed}
      treasuryAccounts={(treasury ?? []) as { id: string; name: string; currency: string }[]}
      profiles={(profiles ?? []) as { id: string; full_name: string | null; email: string }[]}
    />
  )
}
