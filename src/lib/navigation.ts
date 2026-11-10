// Main menu of the CRM, shared by the desktop sidebar, the mobile menu and the middleware.
// No React or server-only imports: this file runs everywhere.
import { allows, pagePermissions, type PermissionSet } from "@/lib/permissions"

export interface NavItem {
  /** Translation key in messages.nav, and the value used in /acces-refuse?m=... */
  key: string
  path: string
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
  { key: "comptabilite", path: "comptabilite" },
  { key: "employes", path: "employes" },
  { key: "documents", path: "documents" },
  { key: "projets", path: "projets" },
  { key: "tracking", path: "tracking" },
  { key: "ai", path: "ai" },
  { key: "settings", path: "parametres/taux-de-change" },
  { key: "singapore-leads", path: "singapore-leads", company: "geg_singapore" },
]

/** Key used for administration pages (users, audit, duplicates): hidden from the menu of non-admins */
export const ADMIN_AREA = "admin"
const ADMIN_PATHS = ["parametres/utilisateurs", "parametres/activite", "parametres/audit", "comptes/doublons"]
const PATH_ALIASES: Record<string, string> = { comptes: "accounts", parametres: "settings" }

export interface NavAccess {
  role: string | null | undefined
  schemas: string[]
  /** Effective permissions in the active company */
  perms: PermissionSet
  /** Active company schema (some menu entries open another page depending on it) */
  activeSchema?: string
}

/**
 * Menu entries that open another page in a given company. GEG Singapour has no stock in use:
 * its Stock entry opens the products catalogue, so it is checked with that page's permission ("produits.voir").
 */
const COMPANY_ENTRY_PATHS: Record<string, Record<string, string>> = {
  geg_singapore: { stock: "stock/produits" },
}

/** Page actually opened for this path in the active company (the path itself in most cases). */
export function companyEntryPath(path: string, activeSchema: string | undefined): string {
  const clean = path.replace(/^\/+|\/+$/g, "")
  return (activeSchema && COMPANY_ENTRY_PATHS[activeSchema]?.[clean]) || path
}

/** Path the menu item links to in the active company */
export function navItemPath(item: NavItem, access: NavAccess): string {
  return companyEntryPath(item.path, access.activeSchema)
}

export function isNavLocked(item: NavItem, access: NavAccess): boolean {
  if (item.company && !access.schemas.includes(item.company)) return true
  const keys = pagePermissions(navItemPath(item, access))
  return !!keys && !allows(access.perms, keys)
}

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

/** What the "access denied" page should show: menu key and the first missing permission */
export interface Denial { key: string; permission?: string }

/** Null when the page can be opened, otherwise the menu key and the missing permission. */
export function deniedForPath(path: string, access: NavAccess): Denial | null {
  const area = navAreaForPath(path)
  if (area && area !== ADMIN_AREA && area.company && !access.schemas.includes(area.company)) return { key: area.key }
  const keys = pagePermissions(companyEntryPath(path, access.activeSchema))
  if (!keys || allows(access.perms, keys)) return null
  if (area === ADMIN_AREA) return { key: ADMIN_AREA }
  return { key: area?.key ?? "dashboard", permission: keys[0] }
}

export function accessDeniedPath(locale: string, key: string, permission?: string): string {
  return `/${locale}/acces-refuse?m=${encodeURIComponent(key)}${permission ? `&p=${encodeURIComponent(permission)}` : ""}`
}
