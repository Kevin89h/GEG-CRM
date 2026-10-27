import SingaporeLeadsClient from "./SingaporeLeadsClient"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSchemaPage } from "@/lib/access"

export default async function SingaporeLeadsPage() {
  await requireSchemaPage("geg_singapore")
  const admin = createAdminClient()
  const { data: leads } = await admin.rpc("get_singapore_deals")
  return <SingaporeLeadsClient leads={leads ?? []} />
}
