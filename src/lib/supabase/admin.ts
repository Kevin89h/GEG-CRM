import { createClient } from "@supabase/supabase-js"
import { auditHeaders } from "@/lib/audit-context"

// Every server call carries the actor of the request, for the audit log (never trusted from a browser)
const auditedFetch: typeof fetch = async (input, init) => {
  const extra = await auditHeaders()
  const h = new Headers(init?.headers)
  for (const [k, v] of Object.entries(extra)) h.set(k, v)
  return fetch(input, { ...init, headers: h })
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: auditedFetch } })
}

export function createSchemaClient(schema: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false }, db: { schema }, global: { fetch: auditedFetch } })
}
