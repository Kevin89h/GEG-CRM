import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import Sidebar from "@/components/layout/Sidebar"

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AppLayout({ children, params }: Props) {
  const { locale } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/${locale}/login`)

  const [{ data: profile }, currentSchema] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    getCompanySchema(),
  ])

  // Charger les sociétés accessibles à cet utilisateur
  const companyAccess: string[] = profile?.company_access ?? []
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, schema_name, country")
    .in("id", companyAccess.length > 0 ? companyAccess : ["00000000-0000-0000-0000-000000000000"])
    .eq("is_active", true)
    .order("name")

  return (
    <div className="flex h-full">
      <Sidebar
        locale={locale}
        profile={profile}
        companies={companies ?? []}
        currentSchema={currentSchema}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
