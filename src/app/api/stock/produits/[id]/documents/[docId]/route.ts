import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { docId } = await params
  const admin = createAdminClient()
  const db = admin.schema("geg_guinee")

  const { data: doc, error: fetchError } = await db
    .from("product_documents")
    .select("url")
    .eq("id", docId)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 })

  if (doc?.url) {
    const path = doc.url.split("/product-documents/")[1]
    if (path) await admin.storage.from("product-documents").remove([decodeURIComponent(path)])
  }

  const { error: deleteError } = await db.from("product_documents").delete().eq("id", docId)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
