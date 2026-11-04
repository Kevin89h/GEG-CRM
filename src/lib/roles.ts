// Roles accepted by public.profiles (profiles_role_check), from most to least powerful.
// Shared by server routes and client components: no server-only imports here.
export const ROLES = [
  { value: "super_admin", label: "Super admin" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "sales_rep", label: "Commercial" },
] as const

export type Role = (typeof ROLES)[number]["value"]

export function roleLabel(role: string | null | undefined): string {
  return ROLES.find(r => r.value === role)?.label ?? role ?? "—"
}

/** Admin rights in the CRM (user management, settings...): admin and super admin. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin"
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "super_admin"
}

/** Roles an actor may give: only a super admin can create another super admin. */
export function assignableRoles(actorRole: string | null | undefined): Role[] {
  if (isSuperAdmin(actorRole)) return ROLES.map(r => r.value)
  if (actorRole === "admin") return ["admin", "manager", "sales_rep"]
  return []
}

export type Permission = { view: boolean; create: boolean; edit: boolean; delete: boolean }
export type Permissions = Record<string, Permission>

export const DEFAULT_PERMISSIONS: Permissions = {
  dashboard:    { view: true,  create: false, edit: false, delete: false },
  accounts:     { view: true,  create: true,  edit: true,  delete: false },
  contacts:     { view: true,  create: true,  edit: true,  delete: false },
  deals:        { view: true,  create: true,  edit: true,  delete: false },
  activities:   { view: true,  create: true,  edit: true,  delete: false },
  ventes:       { view: true,  create: true,  edit: true,  delete: false },
  achats:       { view: true,  create: true,  edit: true,  delete: false },
  stock:        { view: true,  create: true,  edit: true,  delete: false },
  comptabilite: { view: true,  create: false, edit: false, delete: false },
  employes:     { view: true,  create: false, edit: false, delete: false },
  documents:    { view: true,  create: true,  edit: true,  delete: false },
  parametres:   { view: false, create: false, edit: false, delete: false },
}

export const ADMIN_PERMISSIONS: Permissions = Object.fromEntries(
  Object.keys(DEFAULT_PERMISSIONS).map(k => [k, { view: true, create: true, edit: true, delete: true }])
)

export function defaultPermissionsFor(role: string): Permissions {
  return isAdminRole(role) ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS
}
