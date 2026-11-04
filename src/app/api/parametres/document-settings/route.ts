import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { errorResponse, requireAdmin, type Access } from "@/lib/access"
import { isSuperAdmin } from "@/lib/roles"

// A super admin edits every company's settings, an admin only those of their own companies
function mayEdit(actor: Access, companyId: string | null | undefined) {
  return isSuperAdmin(actor.role) || (!!companyId && actor.companyIds.includes(companyId))
}

// POST: upsert document settings (table is in public schema)
export async function POST(req: NextRequest)  {
  try {
    const actor = await requireAdmin()
    const body = await req.json()
    const db = await createClient()

    if (body.id) {
      const { id, ...fields } = body
      const { data: current } = await db.from("document_settings").select("company_id").eq("id", id).single()
      if (!mayEdit(actor, current?.company_id) || ("company_id" in fields && !mayEdit(actor, fields.company_id))) {
        return NextResponse.json({ error: "Accès refusé à cette société" }, { status: 403 })
      }
      const { data, error } = await db
        .from("document_settings")
        .update(fields)
        .eq("id", id)
        .select("id")
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(data)
    }

    if (!mayEdit(actor, body.company_id)) {
      return NextResponse.json({ error: "Accès refusé à cette société" }, { status: 403 })
    }
    const { data, error } = await db
      .from("document_settings")
      .insert([body])
      .select("id")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)

  } catch (err) {
    return errorResponse(err)
  }
}
