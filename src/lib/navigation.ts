// Main menu of the CRM, shared by the desktop sidebar, the mobile menu and the middleware.
// No React or server-only imports: this file runs everywhere.
import { can, pageCapability, type Capability } from "@/lib/permissions"

export interface NavItem {
  /** Translation key in messages.nav, and the value used in /acces-refuse?m=... */
  key: string
  path: string
  /** Right needed to open the module (see src/lib/permissions.ts); none = every role */
  capability?: Capability
  /** Company schema the user must have access to */
  company?: string
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", path: "dashboard" },
  { key: "accounts", path: "accounts" },
  { key: "contacts", path: "contacts" },
  { key: "deals", path: "deals" },
  { key: "activities", path: "activities" },
  { key: "ventes", path: "ventes" },
  { key: "achats", path: "achats" },
  { key: "stock", path: "stock" },
  { key: "comptabilite", path: "comptabilite", capability: "treasury.view" },
  { key: "employes", path: "employes" },
  { key: "documents", path: "documents" },
  { key: "projets", path: "projets" },
  { key: "tracking", path: "tracking" },
  { key: "ai", path: "ai" },
  { key: "settings", path: "parametres/taux-de-change", capability: "settings.write" },
  { key: "singapore-leads", path: "singapore-leads", company: "geg_singapore" },
]

/** Key used for administration pages (users, activity log, duplicates): hidden from the menu of non-admins */
export const ADMIN_AREA = "admin"

export interface NavAccess {
  role: string | null | undefined
  schemas: string[]
}

export function isNavLocked(item: NavItem, access: NavAccess): boolean {
  if (item.company && !access.schemas.includes(item.company)) return true
  return !!item.capability && !can(access.role, item.capability)
}

const ADMIN_PATHS = ["parametres/utilisateurs", "parametres/activite", "comptes/doublons"]
const PATH_ALIASES: Record<string, string> = { comptes: "accounts", parametres: "settings" }

/**
 * Menu item (or the admin area) a page belongs to, from its path without the locale
 * ("ventes/devis/123" → ventes item). Null for pages open to everyone.
 */
export function navAreaForPath(path: string): NavItem | typeof ADMIN_AREA | null {
  const clean = path.replace(/^\/+/, "")
  if (ADMIN_PATHS.some(p => clean === p || clean.startsWith(p + "/"))) return ADMIN_AREA
  const first = clean.split("/")[0]
  const key = PATH_ALIASES[first] ?? first
  return NAV_ITEMS.find(i => i.key === key) ?? null
}

/**
 * Menu key to show on the "access denied" page when this page can't be opened, null when it can.
 * Checks the company, the module and the page itself (e.g. "new purchase" inside the open Purchases module).
 */
export function deniedAreaForPath(path: string, access: NavAccess, isAdmin: boolean): string | null {
  const area = navAreaForPath(path)
  if (area === ADMIN_AREA) return isAdmin ? null : ADMIN_AREA
  if (area && isNavLocked(area, access)) return area.key
  const cap = pageCapability(path)
  if (cap && !can(access.role, cap)) return area?.key ?? "dashboard"
  return null
}

export function accessDeniedPath(locale: string, key: string): string {
  return `/${locale}/acces-refuse?m=${encodeURIComponent(key)}`
}
