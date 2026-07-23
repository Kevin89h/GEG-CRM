import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createCompanyClient, getCompanySchema } from "@/lib/company"

export async function GET() {
  const schema = await getCompanySchema()
  const results: Record<string, unknown> = { schema }

  // Test 1: admin client with .schema()
  try {
    const admin = createAdminClient().schema(schema)
    const { data, error, count } = await (admin as ReturnType<typeof createAdminClient>)
      .from("suppliers")
      .select("id, name, is_active", { count: "exact" })
      .limit(3)
    results.admin_schema_method = { data, error: error?.message, count }
  } catch (e) {
    results.admin_schema_method = { threw: String(e) }
  }

  // Test 2: admin client with schema in constructor options
  try {
    const { createClient } = await import("@supabase/supabase-js")
    const adminDirect = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false }, db: { schema } }
    )
    const { data, error, count } = await adminDirect
      .from("suppliers")
      .select("id, name, is_active", { count: "exact" })
      .limit(3)
    results.admin_constructor_schema = { data, error: error?.message, count }
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
    results.company_client_rls = { data, error: error?.message, count }
  } catch (e) {
    results.company_client_rls = { threw: String(e) }
  }

  // Test 4: env vars present?
  results.env = {
    has_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    url_prefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30),
  }

  return NextResponse.json(results, { status: 200 })
}
