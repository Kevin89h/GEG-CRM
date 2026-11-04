import { cache } from "react"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminRole, isSuperAdmin } from "@/lib/roles"
import { can, type Capability } from "@/lib/permissions"

export const COMPANY_SCHEMAS = ["geg_guinee", "geg_singapore"]

export class AccessError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message)
  }
}

export interface Access {
  userId: string
  role: string
  /** Company schemas the user is allowed to read and write, from profiles.company_access */
  schemas: string[]
  /** Ids of those same companies (public.companies.id) */
  companyIds: string[]
  /** Blocked account (profiles.is_blocked): no right at all, refused everywhere */
  blocked: boolean
}

/**
 * Identity and company rights of the current user, read on the server.
 * Never trusts the geg_company cookie: rights come from profiles.company_access.
 */
export const getAccess = cache(async (): Promise<Access | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const [{ data: profile }, { data: companies }] = await Promise.all([
    admin.from("profiles").select("role, company_access, is_blocked").eq("id", user.id).single(),
    admin.from("companies").select("id, schema_name").eq("is_active", true),
  ])

  const blocked = !!profile?.is_blocked
  const allowedIds = new Set<string>(blocked ? [] : profile?.company_access ?? [])
  const allowed = (companies ?? []).filter(c => allowedIds.has(c.id) && COMPANY_SCHEMAS.includes(c.schema_name))

  return {
    userId: user.id,
    role: blocked ? "" : profile?.role ?? "",
    blocked,
    schemas: allowed.map(c => c.schema_name),
    companyIds: allowed.map(c => c.id),
  }
})

export async function requireUser(): Promise<Access> {
  const access = await getAccess()
  if (!access) throw new AccessError(401, "Non authentifié")
  if (access.blocked) throw new AccessError(403, "Compte bloqué")
  return access
}

/** The role of the current user must give this right (see src/lib/permissions.ts). */
export async function requireCapability(capability: Capability): Promise<Access> {
  const access = await requireUser()
  if (!can(access.role, capability)) throw new AccessError(403, "Votre rôle ne permet pas cette action")
  return access
}

export function hasCapability(access: Access | null, capability: Capability): boolean {
  return !!access && can(access.role, capability, access.blocked)
}

export async function requireAdmin(): Promise<Access> {
  const access = await requireUser()
  if (!isAdminRole(access.role)) throw new AccessError(403, "Accès refusé")
  return access
}

export async function requireSuperAdmin(): Promise<Access> {
  const access = await requireUser()
  if (!isSuperAdmin(access.role)) throw new AccessError(403, "Réservé aux super admins")
  return access
}

/**
 * A super admin manages everyone. An admin manages accounts that are not super admins
 * and whose companies are all among the admin's own companies (an admin of GEG Guinée
 * cannot touch an account that also has GEG Singapore).
 */
export function canManageUser(actor: Access, target: { role: string; company_access: string[] | null }): boolean {
  if (isSuperAdmin(actor.role)) return true
  if (!isAdminRole(actor.role) || isSuperAdmin(target.role)) return false
  return (target.company_access ?? []).every(id => actor.companyIds.includes(id))
}

/** Admin check plus the right to manage this particular account. Returns the actor and the target profile. */
export async function requireCanManageUser(targetId: string) {
  const actor = await requireAdmin()
  const { data: target } = await createAdminClient()
    .from("profiles")
    .select("id, email, role, company_access")
    .eq("id", targetId)
    .single()
  if (!target) throw new AccessError(403, "Utilisateur introuvable")
  if (!canManageUser(actor, target)) throw new AccessError(403, "Vous ne pouvez pas gérer ce compte")
  return { actor, target }
}

export async function requireSchemaAccess(schema: string): Promise<Access> {
  const access = await requireUser()
  if (!access.schemas.includes(schema)) throw new AccessError(403, "Accès refusé à cette société")
  return access
}

/** For pages: shows "not found" instead of an error page when the user can't access the company. */
export async function requireSchemaPage(schema: string): Promise<void> {
  const access = await getAccess()
  if (!access?.schemas.includes(schema)) notFound()
}

/**
 * Active company for this request: the cookie value if the user is allowed on it,
 * otherwise the first company the user is allowed on. No company at all → 403.
 */
export async function resolveCompanySchema(preferred: string | undefined): Promise<string> {
  const access = await requireUser()
  if (access.schemas.length === 0) throw new AccessError(403, "Aucune société attribuée")
  return preferred && access.schemas.includes(preferred) ? preferred : access.schemas[0]
}

/** JSON error response for a route handler's catch block: 401/403 for access errors, 500 otherwise. */
export function errorResponse(err: unknown): Response {
  if (err instanceof AccessError) {
    return Response.json({ error: err.message }, { status: err.status })
  }
  return Response.json({ error: String(err) }, { status: 500 })
}

/**
 * Runs an access check at the top of a route handler.
 * Usage: const denied = await guard(() => requireSchemaAccess("geg_guinee")); if (denied) return denied
 */
export async function guard(check: () => Promise<unknown>): Promise<Response | null> {
  try {
    await check()
    return null
  } catch (err) {
    return errorResponse(err)
  }
}
