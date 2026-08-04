import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import DoublonsClient from "./DoublonsClient"

export default async function DoublonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: profile } = await supabaseAuth.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") redirect(`/${locale}/dashboard`)

  return <DoublonsClient locale={locale} />
}
