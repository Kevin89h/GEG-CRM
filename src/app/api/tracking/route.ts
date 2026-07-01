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
    return { parsed: null, error: "TRACKING_17_KEY manquante dans Vercel" }
  }

  try {
    // Étape 1 : enregistrer le numéro
    const regRes = await fetch("https://api.17track.net/track/v2/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": apiKey },
      body: JSON.stringify([{ number, carrier: 190 }]), // 190 = Sea freight
    })
    const regJson = await regRes.json()
    console.log("17track register:", JSON.stringify(regJson))

    // Étape 2 : récupérer les données
    const res = await fetch("https://api.17track.net/track/v2/gettracklist", {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": apiKey },
      body: JSON.stringify([{ number }]),
    })

    if (!res.ok) return { parsed: null, error: `17track HTTP ${res.status}` }

    const json = await res.json()
    console.log("17track result:", JSON.stringify(json).slice(0, 500))

    const accepted = json?.data?.accepted ?? []
    const rejected = json?.data?.rejected ?? []

    if (rejected.length > 0) {
      return { parsed: null, error: `17track: ${rejected[0]?.error?.message ?? "numéro rejeté"}` }
    }

    const item = accepted[0]
    if (!item) return { parsed: null, error: "Aucune donnée 17track pour ce numéro" }

    return { carrier, parsed: parse17(item) }
  } catch (err) {
    return { parsed: null, error: `Erreur: ${String(err)}` }
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
