"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  LayoutDashboard, Building2, Users, TrendingUp, CalendarCheck,
  ShoppingCart, ShoppingBag, Package, Landmark, LogOut, Globe,
  Settings, UserCheck, FolderOpen, Sparkles, Menu, X,
} from "lucide-react"
import { cn, initials } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/types"
import CompanySwitcher from "./CompanySwitcher"

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

const navItems = [
  { key: "dashboard", icon: LayoutDashboard, path: "dashboard" },
  { key: "accounts", icon: Building2, path: "accounts" },
  { key: "contacts", icon: Users, path: "contacts" },
  { key: "deals", icon: TrendingUp, path: "deals" },
  { key: "activities", icon: CalendarCheck, path: "activities" },
  { key: "ventes", icon: ShoppingCart, path: "ventes" },
  { key: "achats", icon: ShoppingBag, path: "achats" },
  { key: "stock", icon: Package, path: "stock" },
  { key: "comptabilite", icon: Landmark, path: "comptabilite" },
  { key: "employes", icon: UserCheck, path: "employes" },
  { key: "documents", icon: FolderOpen, path: "documents" },
  { key: "ai", icon: Sparkles, path: "ai" },
  { key: "settings", icon: Settings, path: "parametres/taux-de-change" },
] as const

export default function MobileHeader({ locale, profile, companies, currentSchema }: Props) {
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
    router.push(segments.join("/"))
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
          {navItems.map(({ key, icon: Icon, path }) => {
            const href = `/${locale}/${path}`
            const active = pathname.startsWith(href)
            return (
              <Link
                key={key}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {t(key)}
              </Link>
            )
          })}
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
                <p className="text-slate-500 text-xs capitalize">{profile.role?.replace("_", " ")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
