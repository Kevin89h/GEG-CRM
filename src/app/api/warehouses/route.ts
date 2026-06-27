import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { name, city, address } = await req.json()
    if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 })

    const { db } = await createCompanyClient()
    const { data, error } = await db
      .from("warehouses")
      .insert([{ name, city: city || null, address: address || null, is_active: true }])
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    console.error("Warehouse create error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 })

    const { db } = await createCompanyClient()
    const { error } = await db
      .from("warehouses")
      .update({ is_active: false })
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Warehouse delete error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
