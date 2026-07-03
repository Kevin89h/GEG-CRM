import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("product_documents")
    .insert({
      product_id: id,
      type: body.type,
      name: body.name,
      url: body.url,
      file_size: body.file_size ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
