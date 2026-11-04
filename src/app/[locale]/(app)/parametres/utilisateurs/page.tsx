import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { canManageUser, getAccess } from "@/lib/access"
import { assignableRoles, isAdminRole, isSuperAdmin } from "@/lib/roles"
import UtilisateursClient from "./UtilisateursClient"

export default async function UtilisateursPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  // Only admins and super admins can access this page
  const access = await getAccess()
  if (!access) redirect(`/${locale}/login`)
  if (!isAdminRole(access.role)) redirect(`/${locale}/dashboard`)

  const admin = createAdminClient()
  const [{ data: users }, { data: companies }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, role, permissions, company_access").order("full_name"),
    admin.from("companies").select("id, name").eq("is_active", true).order("name"),
  ])

  return (
    <UtilisateursClient
      users={(users ?? []).map(u => ({ ...u, company_access: u.company_access ?? [], manageable: canManageUser(access, u) }))}
      companies={companies ?? []}
      currentUserId={access.userId}
      assignableRoles={assignableRoles(access.role)}
      canAssignCompanies={isSuperAdmin(access.role)}
    />
  )
}
