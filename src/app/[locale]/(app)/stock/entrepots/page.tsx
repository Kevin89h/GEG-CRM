import { createCompanyClient } from "@/lib/company"
import EntrepotsClient from "./EntrepotsClient"

export default async function EntrepotsPage() {
  const { db: supabase } = await createCompanyClient()
  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("*")
    .order("name")
  return <EntrepotsClient warehouses={warehouses ?? []} />
}
