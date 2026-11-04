import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { canManageUser, getAccess } from "@/lib/access"
import { assignableRoles, isAdminRole, isSuperAdmin, roleLabel } from "@/lib/roles"
import { NAV_ITEMS } from "@/lib/navigation"
import UtilisateursClient, { type AccessRequest, type CatalogEntry, type Override } from "./UtilisateursClient"

export default async function UtilisateursPage({ params, searchParams }: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ demande?: string; module?: string; permission?: string; societe?: string }>
}) {
  const { locale } = await params
  const { demande, module, permission, societe } = await searchParams

  const access = await getAccess()
  if (!access) redirect(`/${locale}/login`)
  if (!isAdminRole(access.role)) redirect(`/${locale}/dashboard`)

  const admin = createAdminClient()
  const [{ data: users }, { data: companies }, { data: catalog }, { data: standards }, { data: overrides }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, role, company_access, is_blocked").order("full_name"),
    admin.from("companies").select("id, name, schema_name").eq("is_active", true).order("name"),
    admin.from("permission_catalog").select("key, module, label, sort, sensitive, customizable, grantable_to_sales_rep").order("sort"),
    admin.from("role_permissions").select("role, permission_key"),
    admin.from("user_permission_overrides").select("id, user_id, company_id, permission_key, effect, reason, created_at"),
  ])

  const list = (users ?? []).map(u => ({
    ...u,
    company_access: (u.company_access ?? []) as string[],
    is_blocked: !!u.is_blocked,
    manageable: canManageUser(access, u),
  }))
  const manageableIds = new Set(list.filter(u => u.manageable).map(u => u.id))
  const roleStandards: Record<string, string[]> = {}
  for (const s of standards ?? []) (roleStandards[s.role] ??= []).push(s.permission_key)

  // Access request opened from a notification (?demande=<user>&module=<menu>&permission=<key>&societe=<schema>)
  let accessRequest: AccessRequest | null = null
  const requester = list.find(u => u.id === demande)
  const item = NAV_ITEMS.find(i => i.key === module)
  if (requester && item) {
    const tNav = await getTranslations("nav")
    const company = (companies ?? []).find(c => c.schema_name === (societe ?? (item.company ?? "geg_guinee")))
    const hasCompany = !!company && requester.company_access.includes(company.id)
    const label = (catalog ?? []).find(c => c.key === permission)?.label
    accessRequest = {
      userId: requester.id,
      name: requester.full_name || requester.email,
      role: roleLabel(requester.role),
      module: tNav(item.key),
      companyId: company?.id ?? null,
      companyName: company?.name ?? null,
      permission: permission ?? null,
      permissionLabel: label ?? null,
      kind: !hasCompany ? "company" : permission ? "permission" : "role",
    }
  }

  return (
    <UtilisateursClient
      users={list}
      companies={(companies ?? []).map(({ id, name, schema_name }) => ({ id, name, schema_name }))}
      catalog={(catalog ?? []) as CatalogEntry[]}
      roleStandards={roleStandards}
      overrides={((overrides ?? []) as Override[]).filter(o => manageableIds.has(o.user_id))}
      currentUserId={access.userId}
      actorCompanyIds={access.companyIds}
      isSuperAdmin={isSuperAdmin(access.role)}
      assignableRoles={assignableRoles(access.role)}
      accessRequest={accessRequest}
    />
  )
}
