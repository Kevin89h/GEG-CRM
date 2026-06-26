import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import DocumentSettingsClient from "./DocumentSettingsClient"

export default async function DocumentSettingsPage() {
  const supabase = await createClient()
  const schema = await getCompanySchema()

  // Récupérer la société active
  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("schema_name", schema)
    .single()

  const { data: settings } = await supabase
    .from("document_settings")
    .select("*")
    .eq("company_id", company?.id ?? "")
    .maybeSingle()

  return <DocumentSettingsClient settings={settings} companyId={company?.id ?? ""} />
}
