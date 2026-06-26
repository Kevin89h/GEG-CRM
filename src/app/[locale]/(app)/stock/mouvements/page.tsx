import { createCompanyClient } from "@/lib/company"
import MouvementsClient from "./MouvementsClient"

export default async function MouvementsPage() {
  const { db: supabase } = await createCompanyClient()
  const { data: moves } = await supabase
    .from("stock_moves")
    .select(`
      *,
      product:products(id, name, reference, unit:units(name)),
      from_warehouse:warehouses!stock_moves_from_warehouse_id_fkey(id, name),
      to_warehouse:warehouses!stock_moves_to_warehouse_id_fkey(id, name)
    `)
    .order("created_at", { ascending: false })
    .limit(200)

  return <MouvementsClient moves={moves ?? []} />
}
