import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const carrier = searchParams.get("carrier") ?? ""
  const number = searchParams.get("number") ?? ""

  if (!number) return NextResponse.json({ error: "number requis" }, { status: 400 })

  const result = await track17(number, carrier)
  return NextResponse.json(result)
}

async function track17(number: string, carrier: string) {
  const apiKey = process.env.TRACKING_17_KEY
  if (!apiKey) {
    return { parsed: null, error: "TRACKING_17_KEY manquante dans Vercel" }
  }

  try {
    // Step 1: register the number (queues a fetch from the carrier)
    const regRes = await fetch("https://api.17track.net/track/v2/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": apiKey },
      body: JSON.stringify([{ number }]), // no carrier = 17track auto-detect by number format
    })
    const regJson = await regRes.json()
    console.log("17track register:", JSON.stringify(regJson))

    // Check if registration was accepted or rejected
    const regAccepted = regJson?.data?.accepted ?? []
    const regRejected = regJson?.data?.rejected ?? []
    if (regRejected.length > 0 && regAccepted.length === 0) {
      return { parsed: null, error: `17track registre rejeté: ${regRejected[0]?.error?.message ?? "numéro invalide"}` }
    }

    // 17track fetches from carrier asynchronously — poll up to 3 times with 3s delay
    for (let attempt = 1; attempt <= 3; attempt++) {
      await new Promise(r => setTimeout(r, 3000))

      const res = await fetch("https://api.17track.net/track/v2/gettracklist", {
        method: "POST",
        headers: { "Content-Type": "application/json", "17token": apiKey },
        body: JSON.stringify([{ number }]),
      })

      if (!res.ok) return { parsed: null, error: `17track HTTP ${res.status}` }

      const json = await res.json()
      console.log(`17track gettracklist (attempt ${attempt}):`, JSON.stringify(json).slice(0, 800))

      const accepted = json?.data?.accepted ?? []
      const rejected = json?.data?.rejected ?? []

      if (rejected.length > 0) {
        return { parsed: null, error: `17track: ${rejected[0]?.error?.message ?? "numéro rejeté"}` }
      }

      const item = accepted[0]
      if (!item) continue

      // item.track may be null if 17track hasn't fetched carrier data yet
      const parsed = parse17(item)
      if (parsed) return { carrier, parsed }

      console.log(`17track: track data not ready yet (attempt ${attempt})`)
    }

    return {
      parsed: null,
      error: "17track n'a pas encore récupéré les données — réessayez dans quelques minutes",
    }
  } catch (err) {
    return { parsed: null, error: `Erreur: ${String(err)}` }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parse17(item: any) {
  try {
    const track = item?.track
    if (!track) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
