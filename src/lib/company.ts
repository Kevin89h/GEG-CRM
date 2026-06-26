import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export async function getCompanySchema(): Promise<string> {
  const cookieStore = await cookies()
  return cookieStore.get("geg_company")?.value ?? "geg_guinee"
}

/**
 * Returns a Supabase client scoped to the active company schema.
 * Usage: const { db, schema } = await createCompanyClient()
 *        const { data } = await db.from("accounts").select()
 */
export async function createCompanyClient() {
  const supabase = await createClient()
  const schema = await getCompanySchema()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (supabase as any).schema(schema) as typeof supabase
  return { supabase, db, schema }
}
