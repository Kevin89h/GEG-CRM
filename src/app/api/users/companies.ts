import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Access } from "@/lib/access"
import { isSuperAdmin } from "@/lib/roles"

/**
 * Companies given to an account created or invited by `actor`.
 * - super admin: the companies they chose (must exist), or the database default (GEG Guinée) if none;
 * - admin: always their own companies (an admin cannot choose companies).
 * Returns null to keep the database default, or a 400 response for unknown ids.
 */
export async function resolveNewUserCompanies(actor: Access, companyIds: unknown): Promise<string[] | null | NextResponse> {
  if (!isSuperAdmin(actor.role)) return actor.companyIds
  if (companyIds === undefined) return null
  return validateCompanyIds(companyIds)
}

/** Checks that every id is an existing company. */
export async function validateCompanyIds(companyIds: unknown): Promise<string[] | NextResponse> {
  if (!Array.isArray(companyIds) || companyIds.some(id => typeof id !== "string")) {
    return NextResponse.json({ error: "Liste de sociétés invalide" }, { status: 400 })
  }
  const { data: companies } = await createAdminClient().from("companies").select("id")
  const known = new Set((companies ?? []).map(c => c.id))
  if (companyIds.some(id => !known.has(id))) {
    return NextResponse.json({ error: "Société inconnue" }, { status: 400 })
  }
  return companyIds as string[]
}
