import { createAdminClient } from "@/lib/supabase/admin"
import { getCompanySchema } from "@/lib/company"
import FournisseursClient from "./FournisseursClient"

export default async function FournisseursPage() {
  const schema = await getCompanySchema()
  const admin = createAdminClient().schema(schema)
  const { data } = await admin
    .from("suppliers")
    .select("id, name, phone, email, city, country, currency, notes, payment_terms, iban, swift, bank_name, is_active")
    .eq("is_active", true)
    .order("name")
  return <FournisseursClient fournisseurs={data ?? []} />
}
