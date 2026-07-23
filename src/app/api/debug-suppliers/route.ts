import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createCompanyClient, getCompanySchema } from "@/lib/company"

export async function GET() {
  const schema = await getCompanySchema()
  const results: Record<string, unknown> = { schema }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  results.env = {
    has_url: !!url,
    has_service_role_key: !!key,
    url_prefix: url?.slice(0, 30),
  }

  // Test 1: admin client with .schema()
  try {
    const adminScoped = createClient(url, key, { auth: { persistSession: false } }).schema(schema)
    const { data, error, count } = await adminScoped
      .from("suppliers")
      .select("id, name, is_active", { count: "exact" })
      .limit(3)
    results.admin_schema_method = { data, error: error?.message ?? null, count }
  } catch (e) {
    results.admin_schema_method = { threw: String(e) }
  }

  // Test 2: admin client with schema in constructor
  try {
    const adminDirect = createClient(url, key, {
      auth: { persistSession: false },
      db: { schema },
    })
    const { data, error, count } = await adminDirect
      .from("suppliers")
      .select("id, name, is_active", { count: "exact" })
      .limit(3)
    results.admin_constructor_schema = { data, error: error?.message ?? null, count }
  } catch (e) {
    results.admin_constructor_schema = { threw: String(e) }
  }

  // Test 3: company client (RLS)
  try {
    const { db } = await createCompanyClient()
    const { data, error, count } = await db
      .from("suppliers")
      .select("id, name, is_active", { count: "exact" })
      .limit(3)
    results.company_client_rls = { data, error: error?.message ?? null, count }
  } catch (e) {
    results.company_client_rls = { threw: String(e) }
  }

  return NextResponse.json(results, { status: 200 })
}
