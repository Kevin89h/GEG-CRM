import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import UtilisateursClient from "./UtilisateursClient"

export default async function UtilisateursPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabase = await createClient()

  // Only admins can access this page
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (currentProfile?.role !== "admin") {
    redirect(`/${locale}/dashboard`)
  }

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, permissions")
    .order("full_name")

  return <UtilisateursClient users={users ?? []} />
}
