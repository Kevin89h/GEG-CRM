import { createCompanyClient } from "@/lib/company"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import MouvementsClient from "./MouvementsClient"

export default async function MouvementsPage() {
  const cookieStore = await cookies()
  const schema = cookieStore.get("geg_company")?.value ?? "geg_guinee"
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const adminRaw = serviceKey
    ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
    : null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = adminRaw ? (adminRaw as any).schema(schema) : null

  const { db } = await createCompanyClient()
  const queryDb = adminDb ?? db

  const { data: moves, error } = await queryDb
    .from("stock_moves")
    .select(`
      id, type, quantity, created_at, notes, user_id,
      product:products(id, name, reference, unit:units(name)),
      from_warehouse:warehouses!stock_moves_from_warehouse_id_fkey(id, name),
      to_warehouse:warehouses!stock_moves_to_warehouse_id_fkey(id, name)
    `)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) console.error("stock_moves error:", error.message)

  // Recuperer les emails depuis auth.users
  const userIds = [...new Set((moves ?? []).map((m: { user_id?: string }) => m.user_id).filter(Boolean))]
  let userMap: Record<string, string> = {}
  if (userIds.length > 0 && adminRaw) {
    const { data: users } = await adminRaw.auth.admin.listUsers({ perPage: 1000 })
    userMap = Object.fromEntries(
      (users?.users ?? [])
        .filter(u => userIds.includes(u.id))
        .map(u => [u.id, u.email ?? u.id])
    )
  }

  const movesWithUser = (moves ?? []).map((m: { user_id?: string }) => ({
    ...m,
    created_by: m.user_id ? (userMap[m.user_id] ?? m.user_id) : null,
  }))

  return <MouvementsClient moves={movesWithUser} />
}
