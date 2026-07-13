"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  LayoutDashboard,
  Building2,
  Users,
  TrendingUp,
  CalendarCheck,
  ShoppingCart,
  ShoppingBag,
  Package,
  Landmark,
  LogOut,
  Globe,
  Settings,
  UserCheck,
  FolderOpen,
  Sparkles,
  Activity,
  Ship,
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
  { key: "tracking", icon: Ship, path: "tracking" },
  { key: "ai", icon: Sparkles, path: "ai" },
  { key: "settings", icon: Settings, path: "parametres/taux-de-change" },
] as const

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
        {navItems.map(({ key, icon: Icon, path }) => {
          // Admins see everything; others need explicit view permission
          if (profile?.role !== "admin") {
            const perm = profile?.permissions?.[key]
            if (perm && !perm.view) return null
          }
          const href = `/${locale}/${path}`
          const active = pathname.startsWith(href)
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {t(key)}
            </Link>
          )
        })}

        {/* Journal d'activité — admins only */}
        {profile?.role === "admin" && (() => {
          const href = `/${locale}/parametres/activite`
          const active = pathname.startsWith(href)
          return (
            <Link
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Activity className="w-4 h-4 flex-shrink-0" />
              Journal d'activité
            </Link>
          )
        })()}
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
              <p className="text-slate-500 text-xs capitalize">{profile.role?.replace("_", " ")}</p>
            </div>
          </Link>
        )}
      </div>
    </aside>
  )
}
