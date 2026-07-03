import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db, supabase } = await createCompanyClient()

  // Fetch the document to get the storage path
  const { data: doc, error: fetchError } = await db
    .from("documents")
    .select("file_url")
    .eq("id", id)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 })

  // Delete from storage if we can derive the path
  if (doc?.file_url) {
    const urlParts = doc.file_url.split("/documents/")
    if (urlParts[1]) {
      await supabase.storage.from("documents").remove([decodeURIComponent(urlParts[1])])
    }
  }

  // Delete the DB record
  const { error: deleteError } = await db.from("documents").delete().eq("id", id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
