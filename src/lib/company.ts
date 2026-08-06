import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
