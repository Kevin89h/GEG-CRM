import { NextRequest, NextResponse } from "next/server"
import { createSchemaClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"
import { errorResponse } from "@/lib/access"

// POST — reactivates a deactivated supplier (E3). Permission "fournisseurs.gerer" checked by the middleware.
// Deactivation and reactivation only switch is_active: documents, operations and history are untouched,
// and the change is recorded by the audit log.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const schema = await getSchemaFromRequest(req)
    const { data, error } = await createSchemaClient(schema)
      .from("suppliers")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, is_active")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    return errorResponse(err)
  }
}
