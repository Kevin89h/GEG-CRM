import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("documents")
    .insert({
      name: body.name,
      description: body.description ?? null,
      category_id: body.category_id ?? null,
      account_id: body.account_id ?? null,
      file_url: body.file_url,
      file_name: body.file_name,
      file_size: body.file_size ?? null,
      file_type: body.file_type ?? null,
      uploaded_by: body.uploaded_by,
      visibility: body.visibility ?? "all",
      is_company_doc: body.is_company_doc ?? false,
      doc_type: body.doc_type ?? null,
    })
    .select(`id, name, description, file_url, file_name, file_size, file_type, created_at,
      visibility, is_company_doc, doc_type,
      category:document_categories(id, name, color),
      account:accounts(id, name)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
