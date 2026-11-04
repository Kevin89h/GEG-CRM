"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  LayoutDashboard, Building2, Users, TrendingUp, CalendarCheck, ShoppingCart, ShoppingBag,
  Package, Landmark, UserCheck, FolderOpen, Layers, Ship, Sparkles, Settings, Globe, Activity, Lock,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { allows } from "@/lib/permissions"
import { NAV_ITEMS, accessDeniedPath, isNavLocked, type NavAccess } from "@/lib/navigation"

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, accounts: Building2, contacts: Users, deals: TrendingUp,
  activities: CalendarCheck, ventes: ShoppingCart, achats: ShoppingBag, stock: Package,
  comptabilite: Landmark, employes: UserCheck, documents: FolderOpen, projets: Layers,
  tracking: Ship, ai: Sparkles, settings: Settings, "singapore-leads": Globe,
}

interface Props {
  locale: string
  access: NavAccess
  /** Bigger touch targets for the mobile menu */
  large?: boolean
  onNavigate?: () => void
}

/**
 * Full menu shown to everyone. Items the user can't open keep their place with a lock
 * and lead to the "access denied" page; administration links are only shown to admins.
 */
export default function NavLinks({ locale, access, large = false, onNavigate }: Props) {
  const t = useTranslations("nav")
  const pathname = usePathname()
  const itemClass = (active: boolean, locked: boolean) => cn(
    "flex items-center gap-3 px-3 rounded-lg text-sm font-medium transition-colors",
    large ? "py-3" : "py-2.5",
    active ? "bg-blue-600 text-white"
      : locked ? "text-slate-600 hover:text-slate-400 hover:bg-slate-800/60"
      : "text-slate-400 hover:text-white hover:bg-slate-800"
  )
  const iconClass = large ? "w-5 h-5 flex-shrink-0" : "w-4 h-4 flex-shrink-0"

  return (
    <>
      {NAV_ITEMS.map(item => {
        const Icon = ICONS[item.key]
        const locked = isNavLocked(item, access)
        const href = locked ? accessDeniedPath(locale, item.key) : `/${locale}/${item.path}`
        const active = !locked && pathname.startsWith(`/${locale}/${item.path.split("/")[0]}`)
        return (
          <Link key={item.key} href={href} onClick={onNavigate} className={itemClass(active, locked)}
            title={locked ? "Accès non autorisé" : undefined}>
            <Icon className={iconClass} />
            <span className="flex-1">{t(item.key)}</span>
            {locked && <Lock className="w-3.5 h-3.5 flex-shrink-0" />}
          </Link>
        )
      })}

      {/* Audit log: administration page (journal.voir) */}
      {allows(access.perms, "journal.voir") && (
        <Link href={`/${locale}/parametres/audit`} onClick={onNavigate}
          className={itemClass(pathname.startsWith(`/${locale}/parametres/audit`), false)}>
          <Activity className={iconClass} />
          <span className="flex-1">Journal d&apos;audit</span>
        </Link>
      )}
    </>
  )
}
