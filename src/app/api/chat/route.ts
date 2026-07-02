import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

async function getClients() {
  const cookieStore = await cookies()
  const schema = cookieStore.get("geg_company")?.value ?? "geg_guinee"
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (admin as any).schema(schema) as typeof admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { db, user, schema }
}

// GET /api/chat?action=rooms|messages&room_id=xxx
export async function GET(req: Request) {
  const { db, user } = await getClients()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  if (action === "rooms") {
    const { data: rooms } = await db.from("chat_rooms").select("*").order("created_at")

    // Get unread counts per room
    const { data: receipts } = await db
      .from("chat_read_receipts")
      .select("room_id, last_read_at")
      .eq("user_id", user.id)

    const lastRead: Record<string, string> = {}
    for (const r of receipts ?? []) lastRead[r.room_id] = r.last_read_at

    const unreadCounts: Record<string, number> = {}
    for (const room of rooms ?? []) {
      const since = lastRead[room.id]
      const query = db.from("chat_messages").select("id", { count: "exact", head: true }).eq("room_id", room.id).neq("user_id", user.id)
      const { count } = since ? await query.gt("created_at", since) : await query
      unreadCounts[room.id] = count ?? 0
    }

    return NextResponse.json({ rooms: rooms ?? [], unreadCounts })
  }

  if (action === "messages") {
    const roomId = searchParams.get("room_id")
    if (!roomId) return NextResponse.json({ error: "room_id requis" }, { status: 400 })

    const { data: messages } = await db
      .from("chat_messages")
      .select("id, user_id, user_name, content, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(100)

    return NextResponse.json({ messages: messages ?? [] })
  }

  if (action === "users") {
    const supabase = await createClient()
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .neq("id", user.id)
    return NextResponse.json({ users: profiles ?? [] })
  }

  return NextResponse.json({ error: "action invalide" }, { status: 400 })
}

// POST /api/chat
export async function POST(req: Request) {
  const { db, user } = await getClients()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await req.json()
  const { action } = body

  if (action === "send") {
    const { room_id, content, user_name } = body
    if (!room_id || !content?.trim()) return NextResponse.json({ error: "Données manquantes" }, { status: 400 })

    const { data: msg, error } = await db.from("chat_messages").insert([{
      room_id, user_id: user.id, user_name: user_name || user.email, content: content.trim(),
    }]).select("id, user_id, user_name, content, created_at").single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Auto mark as read for sender
    await db.from("chat_read_receipts").upsert({
      user_id: user.id, room_id, last_read_at: new Date().toISOString(),
    }, { onConflict: "user_id,room_id" })

    return NextResponse.json({ message: msg })
  }

  if (action === "mark_read") {
    const { room_id } = body
    if (!room_id) return NextResponse.json({ error: "room_id requis" }, { status: 400 })

    await db.from("chat_read_receipts").upsert({
      user_id: user.id, room_id, last_read_at: new Date().toISOString(),
    }, { onConflict: "user_id,room_id" })

    return NextResponse.json({ ok: true })
  }

  if (action === "get_or_create_room") {
    const { type, reference_id, name } = body
    if (!type || !name) return NextResponse.json({ error: "type et name requis" }, { status: 400 })

    if (type === "global") {
      const { data: room } = await db.from("chat_rooms").select("*").eq("type", "global").single()
      return NextResponse.json({ room })
    }

    const { data: existing } = await db.from("chat_rooms").select("*").eq("type", type).eq("reference_id", reference_id).maybeSingle()
    if (existing) return NextResponse.json({ room: existing })

    const { data: room, error } = await db.from("chat_rooms").insert([{ type, reference_id, name }]).select("*").single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ room })
  }

  return NextResponse.json({ error: "action invalide" }, { status: 400 })
}
