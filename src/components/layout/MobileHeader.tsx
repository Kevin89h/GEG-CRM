"use client"

import { useState } from "react"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { LogOut, Globe, Menu, X } from "lucide-react"
import { cn, initials } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/types"
import { roleLabel } from "@/lib/roles"
import CompanySwitcher from "./CompanySwitcher"
import NavLinks from "./NavLinks"

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
  /** Effective permissions in the active company */
  perms: string[]
}


export default function MobileHeader({ locale, profile, companies, currentSchema, perms }: Props) {
  const [open, setOpen] = useState(false)
  const t = useTranslations("nav")
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setOpen(false)
    router.push(`/${locale}/login`)
    router.refresh()
  }

  function switchLocale() {
    const next = locale === "fr" ? "en" : "fr"
    const segments = pathname.split("/")
    segments[1] = next
    window.location.href = segments.join("/")
    setOpen(false)
  }

  return (
    <>
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-900 flex items-center justify-between px-4 h-14 md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="text-slate-400 hover:text-white p-1 -ml-1"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <Image
          src="/geg-logo-wide-white.svg"
          alt="GEG"
          width={110}
          height={30}
          className="object-contain"
          priority
        />

        {profile && (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">
              {initials(profile.full_name || profile.email)}
            </span>
          </div>
        )}
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={cn(
        "fixed top-0 left-0 bottom-0 z-50 w-72 bg-slate-900 flex flex-col transition-transform duration-300 ease-in-out md:hidden",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Drawer header */}
        <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
          <Image src="/geg-logo-wide-white.svg" alt="GEG" width={130} height={36} className="object-contain" priority />
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Company switcher */}
        <div className="px-3 pt-3">
          <CompanySwitcher companies={companies} currentSchema={currentSchema} />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <NavLinks
            locale={locale}
            access={{ role: profile?.role, schemas: companies.map(c => c.schema_name), perms }}
            large
            onNavigate={() => setOpen(false)}
          />
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-6 space-y-1 border-t border-slate-800 pt-3">
          <button
            onClick={switchLocale}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            <Globe className="w-5 h-5" />
            {locale === "fr" ? "English" : "Français"}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {t("logout")}
          </button>

          {profile && (
            <div className="flex items-center gap-3 px-3 py-2 mt-2">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-semibold">
                  {initials(profile.full_name || profile.email)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {profile.full_name || profile.email}
                </p>
                <p className="text-slate-500 text-xs capitalize">{roleLabel(profile.role)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
