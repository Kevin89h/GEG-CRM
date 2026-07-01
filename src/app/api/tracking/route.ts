import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const carrier = searchParams.get("carrier") ?? ""
  const number = searchParams.get("number") ?? ""

  if (!number) return NextResponse.json({ error: "number requis" }, { status: 400 })

  // 17track supporte tous les transporteurs maritimes
  const result = await track17(number, carrier)
  return NextResponse.json(result)
}

async function track17(number: string, carrier: string) {
  const apiKey = process.env.TRACKING_17_KEY
  if (!apiKey) {
    return { parsed: null, error: "Clé API 17track manquante (TRACKING_17_KEY)" }
  }

  try {
    // Enregistrer le numéro pour tracking
    await fetch("https://api.17track.net/track/v2/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": apiKey },
      body: JSON.stringify([{ number }]),
    })

    // Récupérer le statut
    const res = await fetch("https://api.17track.net/track/v2/gettracklist", {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": apiKey },
      body: JSON.stringify([{ number }]),
    })

    if (!res.ok) return { parsed: null, error: `17track API error ${res.status}` }

    const json = await res.json()
    const item = json?.data?.accepted?.[0]
    if (!item) return { parsed: null, error: "Numéro non trouvé" }

    return { carrier, parsed: parse17(item) }
  } catch (err) {
    return { parsed: null, error: String(err) }
  }
}

function parse17(item: any) {
  try {
    const track = item?.track
    const events = (track?.z ?? []).map((e: any) => ({
      date: e?.a ?? "",
      location: e?.c ?? "",
      description: e?.z ?? e?.d ?? "",
    }))

    const latest = events[0]
    const info = track?.b ?? {}

    return {
      status: latest?.description ?? track?.e ?? "En transit",
      lastLocation: latest?.location ?? "",
      lastDate: latest?.date ?? "",
      events: events.slice(0, 15),
      eta: info?.y ?? track?.c ?? null,
      vessel: info?.c ?? null,
      origin: info?.a ?? null,
      destination: info?.b ?? null,
    }
  } catch { return null }
}
