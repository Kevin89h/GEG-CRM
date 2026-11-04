"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { LogOut, Globe } from "lucide-react"
import { initials } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/types"
import { roleLabel } from "@/lib/roles"
import CompanySwitcher from "./CompanySwitcher"
import NavLinks from "./NavLinks"
import NotificationBell from "./NotificationBell"

interface Company {
  id: string
  name: string
  schema_name: string
  country: string | null
}

interface Props {
  locale: string
  profile: Profile | null
  companies: Company[]
  currentSchema: string
}


export default function Sidebar({ locale, profile, companies, currentSchema }: Props) {
  const t = useTranslations("nav")
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${locale}/login`)
    router.refresh()
  }

  function switchLocale() {
    const next = locale === "fr" ? "en" : "fr"
    const segments = pathname.split("/")
    segments[1] = next
    window.location.href = segments.join("/")
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900 flex flex-col h-full">
      {/* Brand */}
      <div className="px-6 py-4 border-b border-slate-800">
        <Image src="/geg-logo-wide-white.svg" alt="GEG" width={160} height={42} className="object-contain" priority />
      </div>

      {/* Company switcher */}
      <div className="px-3 pt-3">
        <CompanySwitcher companies={companies} currentSchema={currentSchema} />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <NavLinks
          locale={locale}
          access={{ role: profile?.role, schemas: companies.map(c => c.schema_name) }}
        />
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-1 border-t border-slate-800 pt-3">
        {/* Locale switcher */}
        <button
          onClick={switchLocale}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
        >
          <Globe className="w-4 h-4" />
          {locale === "fr" ? "English" : "Français"}
        </button>

        {/* Notifications */}
        {profile && (
          <div className="flex items-center gap-3 px-3 py-2">
            <NotificationBell userId={profile.id} locale={locale} />
            <span className="text-slate-400 text-sm font-medium">Notifications</span>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 text-sm font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t("logout")}
        </button>

        {/* Profile */}
        {profile && (
          <Link href={`/${locale}/profil`} className="flex items-center gap-3 px-3 py-2 mt-2 rounded-lg hover:bg-slate-800 transition-colors">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name || profile.email} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xs font-semibold">
                  {initials(profile.full_name || profile.email)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {profile.full_name || profile.email}
              </p>
              <p className="text-slate-500 text-xs capitalize">{roleLabel(profile.role)}</p>
            </div>
          </Link>
        )}
      </div>
    </aside>
  )
}
