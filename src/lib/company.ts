import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createSchemaClient } from "@/lib/supabase/admin"
import { resolveCompanySchema } from "@/lib/access"

/**
 * Use in Route Handlers by passing the NextRequest.
 * The geg_company cookie is only a preference: the schema is checked against the user's rights.
 */
export async function getSchemaFromRequest(req: NextRequest): Promise<string> {
  return resolveCompanySchema(req.cookies.get("geg_company")?.value)
}

/** Use in Server Components, Server Actions, and Route Handlers without a req object. */
export async function getCompanySchema(): Promise<string> {
  const cookieStore = await cookies()
  return resolveCompanySchema(cookieStore.get("geg_company")?.value)
}

/**
 * Returns a Supabase admin client scoped to the active company schema via db.schema
 * (reliable — set at construction time, not via .schema() after the fact).
 * Usage: const { db, schema } = await createCompanyClient()
 *        const { data } = await db.from("accounts").select()
 */
export async function createCompanyClient() {
  const supabase = await createClient()
  const schema = await getCompanySchema()
  const db = createSchemaClient(schema)
  return { supabase, db, schema }
}
