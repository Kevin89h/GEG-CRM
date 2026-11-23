// Safe stock level writes without a database transaction (phase 0 of the stock reliability plan, GEG 23/11/2026).
// Each level change is a COMPARE-AND-SET: the row is only updated if it still holds the quantity read just before.
// A concurrent change makes the write fail (nothing is overwritten) instead of silently losing an update.
// Phase 1 replaces these helpers with database functions running in a single transaction.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export async function readLevel(db: Db, productId: string, warehouseId: string): Promise<{ exists: boolean; quantity: number }> {
  const { data, error } = await db.from("stock_levels").select("quantity").eq("product_id", productId).eq("warehouse_id", warehouseId).maybeSingle()
  if (error) throw new Error(`stock_levels: ${error.message}`)
  return { exists: !!data, quantity: Number(data?.quantity ?? 0) }
}

/** Sets the level from `expected` to `next`; returns false when the stock changed meanwhile (nothing written). */
export async function casLevel(db: Db, productId: string, warehouseId: string, expected: { exists: boolean; quantity: number }, next: number): Promise<boolean> {
  if (next < 0) throw new Error("Le stock ne peut pas devenir négatif")
  if (expected.exists) {
    const { data, error } = await db.from("stock_levels")
      .update({ quantity: next, updated_at: new Date().toISOString() })
      .eq("product_id", productId).eq("warehouse_id", warehouseId).eq("quantity", expected.quantity)
      .select("id")
    if (error) throw new Error(`stock_levels: ${error.message}`)
    return (data ?? []).length === 1
  }
  // no row yet: the unique (product_id, warehouse_id) key makes a concurrent creation fail instead of doubling
  const { error } = await db.from("stock_levels").insert([{ product_id: productId, warehouse_id: warehouseId, quantity: next }])
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) return false
    throw new Error(`stock_levels: ${error.message}`)
  }
  return true
}

export const CONCURRENT_MSG = "Le stock vient d'être modifié par une autre opération : rien n'a été enregistré. Rechargez la page et recommencez."
