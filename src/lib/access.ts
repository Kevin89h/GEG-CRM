import { cache } from "react"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminRole, isSuperAdmin } from "@/lib/roles"
import { allows } from "@/lib/permissions"

export const COMPANY_SCHEMAS = ["geg_guinee", "geg_singapore"]

export class AccessError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message)
  }
}

export interface Access {
  userId: string
  role: string
  /** Company schemas the user is allowed on, from profiles.company_access (empty when blocked) */
  schemas: string[]
  /** Ids of those same companies (public.companies.id) */
  companyIds: string[]
  /** Blocked account: no right at all */
  blocked: boolean
  /** Effective permissions per company schema (role standard + personal exceptions of that company) */
  perms: Record<string, string[]>
}

/**
 * Identity, companies and effective permissions of the current user, read on the server.
 * Never trusts the geg_company cookie: rights come from the profile and public.effective_permissions.
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

  const perms: Record<string, string[]> = {}
  await Promise.all(allowed.map(async c => {
    const { data } = await admin.rpc("effective_permissions", { p_user: user.id, p_schema: c.schema_name })
    perms[c.schema_name] = (data as string[] | null) ?? []
  }))

  return {
    userId: user.id,
    role: blocked ? "" : profile?.role ?? "",
    schemas: allowed.map(c => c.schema_name),
    companyIds: allowed.map(c => c.id),
    blocked,
    perms,
  }
})

export async function requireUser(): Promise<Access> {
  const access = await getAccess()
  if (!access) throw new AccessError(401, "Non authentifié")
  if (access.blocked) throw new AccessError(403, "Compte bloqué")
  return access
}

/** Active company of the request: the cookie if allowed, else the first allowed company. */
export async function activeSchema(access: Access): Promise<string> {
  const preferred = (await cookies()).get("geg_company")?.value
  if (access.schemas.length === 0) throw new AccessError(403, "Aucune société attribuée")
  return preferred && access.schemas.includes(preferred) ? preferred : access.schemas[0]
}

/** True when the user holds one of the keys in this company (default: the active company). */
export async function hasPermission(keys: string | string[], schema?: string): Promise<boolean> {
  const access = await getAccess()
  if (!access || access.blocked) return false
  const s = schema ?? (await activeSchema(access).catch(() => null))
  return !!s && allows(access.perms[s], keys)
}

/** The user must hold one of the keys in this company (default: the active company). */
export async function requirePermission(keys: string | string[], schema?: string): Promise<Access> {
  const access = await requireUser()
  const s = schema ?? (await activeSchema(access))
  if (!allows(access.perms[s], keys)) throw new AccessError(403, "Votre rôle ou vos permissions ne permettent pas cette action")
  return access
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
 * Who may manage whom (decision Q3):
 * - a super admin manages every account except his own;
 * - an admin manages only Managers and Commercials whose companies are all among his own;
 * - nobody else manages accounts.
 */
export function canManageUser(actor: Access, target: { id?: string; role: string; company_access: string[] | null }): boolean {
  if (actor.blocked || (target.id && target.id === actor.userId)) return false
  if (isSuperAdmin(actor.role)) return true
  if (actor.role !== "admin") return false
  if (target.role !== "manager" && target.role !== "sales_rep") return false
  return (target.company_access ?? []).every(id => actor.companyIds.includes(id))
}

/** Admin check plus the right to manage this particular account. Returns the actor and the target profile. */
export async function requireCanManageUser(targetId: string) {
  const actor = await requireAdmin()
  const { data: target } = await createAdminClient()
    .from("profiles")
    .select("id, email, role, company_access, is_blocked")
    .eq("id", targetId)
    .single()
  if (!target) throw new AccessError(403, "Utilisateur introuvable")
  if (target.id === actor.userId) throw new AccessError(403, "Vous ne pouvez pas modifier votre propre compte")
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
  const message = err instanceof Error ? err.message : String(err)
  return Response.json({ error: message }, { status: 500 })
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
