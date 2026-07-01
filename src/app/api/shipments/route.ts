import { createClient as createAdminClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

async function getAdminDb() {
  const cookieStore = await cookies()
  const schema = cookieStore.get("geg_company")?.value ?? "geg_guinee"
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (admin as any).schema(schema) as typeof admin
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { type, carrier, tracking_number, description, origin, destination, eta, status, notes } = body
    if (!tracking_number || !carrier) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })
    }
    const db = await getAdminDb()
    const { data, error } = await db.from("shipments").insert([{
      type, carrier, tracking_number,
      description: description || null,
      origin: origin || null,
      destination: destination || null,
      eta: eta || null,
      status: status ?? "in_transit",
      notes: notes || null,
    }]).select("*").single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ shipment: data })
  } catch (err) {
    console.error("Shipment POST error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 })
    const db = await getAdminDb()
    const { error } = await db.from("shipments").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Shipment DELETE error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
