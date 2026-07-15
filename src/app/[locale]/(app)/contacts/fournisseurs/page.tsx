import { createCompanyClient } from "@/lib/company"
import FournisseursClient from "./FournisseursClient"

export default async function FournisseursPage() {
  const { db } = await createCompanyClient()
  const { data } = await db
    .from("accounts")
    .select("id, name, phone, email, city, country, supplier_currency, supplier_notes")
    .eq("is_supplier", true)
    .order("name")
  return <FournisseursClient fournisseurs={data ?? []} />
}
