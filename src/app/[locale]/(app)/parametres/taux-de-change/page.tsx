import { createCompanyClient } from "@/lib/company"
import TauxDeChangeClient from "./TauxDeChangeClient"

export default async function TauxDeChangePage() {
  const { db: supabase } = await createCompanyClient()
  const { data: rates } = await supabase
    .from("exchange_rates")
    .select("id, from_currency, to_currency, rate, effective_date, notes")
    .order("effective_date", { ascending: false })

  return <TauxDeChangeClient rates={rates ?? []} />
}
