import { activeSchema, getAccess } from "@/lib/access"

/** Effective permissions of the current user in the active company (empty when not signed in or blocked). */
export async function currentPerms(): Promise<string[]> {
  const access = await getAccess()
  if (!access || access.blocked) return []
  const schema = await activeSchema(access).catch(() => null)
  return schema ? access.perms[schema] ?? [] : []
}
