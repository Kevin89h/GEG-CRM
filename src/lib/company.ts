import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createSchemaClient } from "@/lib/supabase/admin"

const ALLOWED_SCHEMAS = new Set(["geg_guinee", "geg_singapore"])

function resolveSchema(raw: string | undefined): string {
  return raw && ALLOWED_SCHEMAS.has(raw) ? raw : "geg_guinee"
}

/** Use in Route Handlers by passing the NextRequest — avoids next/headers timing issues. */
export function getSchemaFromRequest(req: NextRequest): string {
  return resolveSchema(req.cookies.get("geg_company")?.value)
}

/** Use in Server Components, Server Actions, and Route Handlers without a req object. */
export async function getCompanySchema(): Promise<string> {
  try {
    const cookieStore = await cookies()
    return resolveSchema(cookieStore.get("geg_company")?.value)
  } catch {
    return "geg_guinee"
  }
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
