/**
 * Browser-side helper to get a Supabase client scoped to the active company schema.
 * Reads the geg_company cookie (set to httpOnly: false so JS can access it).
 * Use this in all client components that perform inserts/updates into company tables.
 *
 * Usage:
 *   const { supabase, db } = getCompanyClientBrowser()
 *   const { data } = await db.from("sales_orders").insert(...)
 *   // auth operations: supabase.auth.getUser()
 */

import { createClient } from "@/lib/supabase/client"

function getCompanySchema(): string {
  if (typeof document === "undefined") return "geg_guinee"
  const match = document.cookie.match(/(?:^|;\s*)geg_company=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : "geg_guinee"
}

export function getCompanyClientBrowser() {
  const supabase = createClient()
  const schema = getCompanySchema()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (supabase as any).schema(schema) as typeof supabase
  return { supabase, db, schema }
}
