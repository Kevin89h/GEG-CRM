import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { schema } = await req.json()
  if (!schema || typeof schema !== "string") {
    return NextResponse.json({ error: "Schéma invalide" }, { status: 400 })
  }

  // Vérifier que l'utilisateur a accès à cette société
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_access")
    .eq("id", user.id)
    .single()

  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 403 })

  // Vérifier que le schéma demandé correspond à une société accessible
  const { data: company } = await supabase
    .from("companies")
    .select("id, schema_name")
    .eq("schema_name", schema)
    .in("id", profile.company_access ?? [])
    .single()

  if (!company) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const res = NextResponse.json({ success: true, schema: company.schema_name })
  res.cookies.set("geg_company", company.schema_name, {
    httpOnly: false, // lisible côté browser pour les mutations client
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 an
  })
  return res
}
