import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const carrier = searchParams.get("carrier") ?? ""
  const number = searchParams.get("number") ?? ""

  if (!carrier || !number) {
    return NextResponse.json({ error: "carrier et number requis" }, { status: 400 })
  }

  try {
    if (carrier === "MSC") return await trackMSC(number)
    if (carrier === "CMA CGM") return await trackCMA(number)
    return NextResponse.json({ error: "Transporteur non supporté pour le tracking live" }, { status: 400 })
  } catch (err) {
    console.error("Tracking error:", err)
    return NextResponse.json({ error: "Erreur lors de la récupération du tracking" }, { status: 500 })
  }
}

async function trackMSC(number: string) {
  const url = `https://www.msc.com/api/feature/tools/TrackingInfo?trackingNumber=${encodeURIComponent(number)}&languageCode=fr`
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Referer": "https://www.msc.com/",
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    return NextResponse.json({ error: `MSC API error ${res.status}`, raw: null }, { status: 200 })
  }

  const json = await res.json()
  return NextResponse.json({ carrier: "MSC", raw: json, parsed: parseMSC(json) })
}

function parseMSC(json: any) {
  try {
    const tracking = json?.trackingDetails ?? json
    const containers = tracking?.containers ?? tracking?.Containers ?? []
    const events: { date: string; location: string; description: string }[] = []

    for (const c of containers) {
      const moves = c?.movements ?? c?.Movements ?? []
      for (const m of moves) {
        events.push({
          date: m?.activityDate ?? m?.ActivityDate ?? "",
          location: `${m?.location ?? m?.Location ?? ""} ${m?.portCode ?? m?.PortCode ?? ""}`.trim(),
          description: m?.activityDescription ?? m?.ActivityDescription ?? m?.description ?? "",
        })
      }
    }

    const lastEvent = events[0]
    return {
      status: lastEvent?.description ?? "En transit",
      lastLocation: lastEvent?.location ?? "",
      lastDate: lastEvent?.date ?? "",
      events: events.slice(0, 10),
      eta: tracking?.eta ?? tracking?.Eta ?? null,
    }
  } catch {
    return null
  }
}

async function trackCMA(number: string) {
  // CMA CGM — try both BL number and container number formats
  const endpoints = [
    `https://www.cma-cgm.com/ebusiness/tracking/json?numero=${encodeURIComponent(number)}`,
    `https://www.cma-cgm.com/ebusiness/tracking/json?container=${encodeURIComponent(number)}`,
  ]

  const headers = {
    "Accept": "application/json, text/javascript, */*",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.cma-cgm.com/ebusiness/tracking/search",
    "X-Requested-With": "XMLHttpRequest",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  }

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers, next: { revalidate: 0 } })
      if (!res.ok) continue
      const text = await res.text()
      let json: any = null
      try { json = JSON.parse(text) } catch { continue }
      const parsed = parseCMA(json)
      if (parsed && (parsed.events.length > 0 || parsed.status)) {
        return NextResponse.json({ carrier: "CMA CGM", raw: json, parsed })
      }
    } catch { continue }
  }

  // Fallback: return error with link to manual tracking
  return NextResponse.json({
    carrier: "CMA CGM",
    raw: null,
    parsed: null,
    trackingUrl: `https://www.cma-cgm.com/ebusiness/tracking/search?numero=${encodeURIComponent(number)}`,
    error: "API CMA CGM non accessible — utilisez le lien direct"
  }, { status: 200 })
}

function parseCMA(json: any) {
  try {
    if (!json) return null
    const events: { date: string; location: string; description: string }[] = []
    const containers = json?.containers ?? json?.tracking?.containers ?? []

    for (const c of containers) {
      const moves = c?.events ?? c?.movements ?? []
      for (const m of moves) {
        events.push({
          date: m?.eventDate ?? m?.date ?? "",
          location: m?.location ?? m?.port ?? "",
          description: m?.eventDescription ?? m?.description ?? "",
        })
      }
    }

    const lastEvent = events[0]
    return {
      status: lastEvent?.description ?? "En transit",
      lastLocation: lastEvent?.location ?? "",
      lastDate: lastEvent?.date ?? "",
      events: events.slice(0, 10),
      eta: json?.eta ?? null,
    }
  } catch {
    return null
  }
}
