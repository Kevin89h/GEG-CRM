import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { canManageUser, getAccess } from "@/lib/access"
import { assignableRoles, isAdminRole, isSuperAdmin, roleLabel } from "@/lib/roles"
import { NAV_ITEMS, isNavLocked } from "@/lib/navigation"
import UtilisateursClient, { type AccessRequest } from "./UtilisateursClient"

export default async function UtilisateursPage({ params, searchParams }: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ demande?: string; module?: string }>
}) {
  const { locale } = await params
  const { demande, module } = await searchParams

  // Only admins and super admins can access this page
  const access = await getAccess()
  if (!access) redirect(`/${locale}/login`)
  if (!isAdminRole(access.role)) redirect(`/${locale}/dashboard`)

  const admin = createAdminClient()
  const [{ data: users }, { data: companies }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, role, permissions, company_access").order("full_name"),
    admin.from("companies").select("id, name, schema_name").eq("is_active", true).order("name"),
  ])

  // Access request opened from a notification (?demande=<user id>&module=<menu key>)
  let accessRequest: AccessRequest | null = null
  const requester = users?.find(u => u.id === demande)
  const item = NAV_ITEMS.find(i => i.key === module)
  if (requester && item) {
    const tNav = await getTranslations("nav")
    const schemas = (companies ?? []).filter(c => (requester.company_access ?? []).includes(c.id)).map(c => c.schema_name)
    accessRequest = {
      userId: requester.id,
      name: requester.full_name || requester.email,
      role: roleLabel(requester.role),
      module: tNav(item.key),
      kind: item.company ? "company" : "role",
      granted: !isNavLocked(item, { role: requester.role, permissions: requester.permissions, schemas }),
    }
  }

  return (
    <UtilisateursClient
      users={(users ?? []).map(u => ({ ...u, company_access: u.company_access ?? [], manageable: canManageUser(access, u) }))}
      companies={(companies ?? []).map(({ id, name }) => ({ id, name }))}
      currentUserId={access.userId}
      assignableRoles={assignableRoles(access.role)}
      canAssignCompanies={isSuperAdmin(access.role)}
      accessRequest={accessRequest}
    />
  )
}
