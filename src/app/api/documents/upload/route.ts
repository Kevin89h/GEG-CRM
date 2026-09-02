import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 })

    const path = `${user.id}/${Date.now()}_${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const admin = createAdminClient()
    const { error: storageError } = await admin.storage
      .from("documents")
      .upload(path, buffer, { contentType: file.type })

    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 400 })

    const { data: { publicUrl } } = admin.storage
      .from("documents")
      .getPublicUrl(path)

    return NextResponse.json({ path, publicUrl })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
