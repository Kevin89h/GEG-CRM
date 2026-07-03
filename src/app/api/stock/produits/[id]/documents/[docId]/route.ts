import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { docId } = await params
  const { db, supabase } = await createCompanyClient()

  // Fetch the document URL to remove from storage
  const { data: doc, error: fetchError } = await db
    .from("product_documents")
    .select("url")
    .eq("id", docId)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 })

  // Delete from storage
  if (doc?.url) {
    const path = doc.url.split("/product-documents/")[1]
    if (path) await supabase.storage.from("product-documents").remove([decodeURIComponent(path)])
  }

  // Delete the DB record
  const { error: deleteError } = await db.from("product_documents").delete().eq("id", docId)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
