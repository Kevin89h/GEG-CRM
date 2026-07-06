import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { name, type } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 })

    const { db } = await createCompanyClient()
    const { data, error } = await db
      .from("units")
      .insert([{ name: name.trim(), type: type ?? "unit" }])
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ unit: data })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
