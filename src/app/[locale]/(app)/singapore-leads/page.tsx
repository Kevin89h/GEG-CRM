import SingaporeLeadsClient from "./SingaporeLeadsClient"
import { createAdminClient } from "@/lib/supabase/admin"

export default async function SingaporeLeadsPage() {
  const admin = createAdminClient()
  const { data: leads } = await admin.rpc("get_singapore_deals")
  return <SingaporeLeadsClient leads={leads ?? []} />
}
