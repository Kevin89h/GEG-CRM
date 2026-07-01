import { createClient as createAdminClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import TrackingClient from './TrackingClient'

export default async function TrackingPage() {
  const cookieStore = await cookies()
  const schema = cookieStore.get("geg_company")?.value ?? "geg_guinee"

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (admin as any).schema(schema) as typeof admin

  const { data: shipments, error } = await db
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) console.error('Tracking fetch error:', error.message)

  return <TrackingClient shipments={shipments ?? []} schema={schema} />
}
