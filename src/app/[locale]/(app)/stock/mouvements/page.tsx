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
    .select("id, type, quantity, created_at, notes, user_id, product_id, from_warehouse_id, to_warehouse_id")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) console.error("stock_moves error:", error.message)

  // Charger produits et entrepots separement
  const productIds = [...new Set((moves ?? []).map((m: { product_id?: string }) => m.product_id).filter(Boolean))]
  const warehouseIds = [...new Set([
    ...(moves ?? []).map((m: { from_warehouse_id?: string }) => m.from_warehouse_id),
    ...(moves ?? []).map((m: { to_warehouse_id?: string }) => m.to_warehouse_id),
  ].filter(Boolean))]

  const [{ data: products }, { data: warehouses }] = await Promise.all([
    productIds.length > 0 ? queryDb.from("products").select("id, name, reference, unit:units(name)").in("id", productIds) : { data: [] },
    warehouseIds.length > 0 ? queryDb.from("warehouses").select("id, name").in("id", warehouseIds) : { data: [] },
  ])

  const prodMap = Object.fromEntries((products ?? []).map((p: { id: string }) => [p.id, p]))
  const whMap = Object.fromEntries((warehouses ?? []).map((w: { id: string }) => [w.id, w]))

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

  const movesWithUser = (moves ?? []).map((m: { user_id?: string; product_id?: string; from_warehouse_id?: string; to_warehouse_id?: string }) => ({
    ...m,
    created_by: m.user_id ? (userMap[m.user_id] ?? m.user_id) : null,
    product: m.product_id ? prodMap[m.product_id] ?? null : null,
    from_warehouse: m.from_warehouse_id ? whMap[m.from_warehouse_id] ?? null : null,
    to_warehouse: m.to_warehouse_id ? whMap[m.to_warehouse_id] ?? null : null,
  }))

  return <MouvementsClient moves={movesWithUser} />
}
