import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCompanySchema } from "@/lib/company"
import Sidebar from "@/components/layout/Sidebar"
import MobileHeader from "@/components/layout/MobileHeader"
import ChatWidget from "@/components/chat/ChatWidget"
import PwaInstallBanner from "@/components/PwaInstallBanner"
import PushSubscriber from "@/components/PushSubscriber"

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

  const companyAccess: string[] = profile?.company_access ?? []
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, schema_name, country")
    .in("id", companyAccess.length > 0 ? companyAccess : ["00000000-0000-0000-0000-000000000000"])
    .eq("is_active", true)
    .order("name")

  const sharedProps = {
    locale,
    profile,
    companies: companies ?? [],
    currentSchema,
  }

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar {...sharedProps} />
      </div>

      {/* Mobile header + drawer */}
      <MobileHeader {...sharedProps} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="max-w-7xl mx-auto px-4 py-4 md:px-6 md:py-8">
          {children}
        </div>
      </main>

      <PwaInstallBanner />
      <PushSubscriber />

      <div className="no-print" data-no-pdf>
        <ChatWidget
          currentUserId={user.id}
          currentUserName={profile?.full_name || profile?.email || user.email || ""}
        />
      </div>
    </div>
  )
}
