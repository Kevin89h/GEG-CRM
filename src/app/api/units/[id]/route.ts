import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, type } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 })

    const { db } = await createCompanyClient()
    const { data, error } = await db
      .from("units")
      .update({ name: name.trim(), type: type ?? "unit" })
      .eq("id", id)
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ unit: data })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { db } = await createCompanyClient()
    const { error } = await db.from("units").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
