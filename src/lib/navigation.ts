// Main menu of the CRM, shared by the desktop sidebar, the mobile menu and the middleware.
// No React or server-only imports: this file runs everywhere.
import { isAdminRole } from "@/lib/roles"

export interface NavItem {
  /** Translation key in messages.nav, and the value used in /acces-refuse?m=... */
  key: string
  path: string
  /** Module of profiles.permissions whose "view" right opens the item */
  permission?: string
  /** Company schema the user must have access to */
  company?: string
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", path: "dashboard", permission: "dashboard" },
  { key: "accounts", path: "accounts", permission: "accounts" },
  { key: "contacts", path: "contacts", permission: "contacts" },
  { key: "deals", path: "deals", permission: "deals" },
  { key: "activities", path: "activities", permission: "activities" },
  { key: "ventes", path: "ventes", permission: "ventes" },
  { key: "achats", path: "achats", permission: "achats" },
  { key: "stock", path: "stock", permission: "stock" },
  { key: "comptabilite", path: "comptabilite", permission: "comptabilite" },
  { key: "employes", path: "employes", permission: "employes" },
  { key: "documents", path: "documents", permission: "documents" },
  { key: "projets", path: "projets" },
  { key: "tracking", path: "tracking" },
  { key: "ai", path: "ai" },
  { key: "settings", path: "parametres/taux-de-change", permission: "parametres" },
  { key: "singapore-leads", path: "singapore-leads", company: "geg_singapore" },
]

/** Key used for administration pages (users, activity log, duplicates): hidden from the menu of non-admins */
export const ADMIN_AREA = "admin"

export interface NavAccess {
  role: string | null | undefined
  permissions: Record<string, { view?: boolean } | undefined> | null | undefined
  schemas: string[]
}

export function isNavLocked(item: NavItem, access: NavAccess): boolean {
  if (item.company && !access.schemas.includes(item.company)) return true
  if (isAdminRole(access.role) || !item.permission) return false
  // A module missing from the grid stays open, as before
  const perm = access.permissions?.[item.permission]
  return !!perm && !perm.view
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

export function accessDeniedPath(locale: string, key: string): string {
  return `/${locale}/acces-refuse?m=${encodeURIComponent(key)}`
}
