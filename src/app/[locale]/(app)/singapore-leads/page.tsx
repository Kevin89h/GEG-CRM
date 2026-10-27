import SingaporeLeadsClient from "./SingaporeLeadsClient"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSchemaAccess } from "@/lib/access"

export default async function SingaporeLeadsPage() {
  await requireSchemaAccess("geg_singapore")
  const admin = createAdminClient()
  const { data: leads } = await admin.rpc("get_singapore_deals")
  return <SingaporeLeadsClient leads={leads ?? []} />
}
