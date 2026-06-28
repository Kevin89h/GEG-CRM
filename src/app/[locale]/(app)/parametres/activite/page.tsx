import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import ActivityClient from "./ActivityClient"

export default async function ActivityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") redirect(`/${locale}/dashboard`)

  // Fetch users list for filters
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profiles } = await admin.from("profiles").select("id, full_name, email").order("full_name")
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 200 })

  const lastLogins: Record<string, string> = {}
  for (const u of authUsers?.users ?? []) {
    if (u.last_sign_in_at) lastLogins[u.id] = u.last_sign_in_at
  }

  return <ActivityClient users={profiles ?? []} lastLogins={lastLogins} />
}
