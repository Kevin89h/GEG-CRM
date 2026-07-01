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
    return NextResponse.json({ error: "Transporteur non supporté" }, { status: 400 })
  } catch (err) {
    console.error("Tracking error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// ─── MSC ────────────────────────────────────────────────────────────────────

async function trackMSC(number: string) {
  const url = `https://www.msc.com/api/feature/tools/TrackingInfo?trackingNumber=${encodeURIComponent(number)}&languageCode=fr`
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://www.msc.com/",
    },
  })
  if (!res.ok) return NextResponse.json({ carrier: "MSC", parsed: null, error: `HTTP ${res.status}` })
  const json = await res.json()
  return NextResponse.json({ carrier: "MSC", parsed: parseMSC(json) })
}

function parseMSC(json: any) {
  try {
    const containers = json?.trackingDetails?.containers ?? json?.containers ?? []
    const events: { date: string; location: string; description: string }[] = []
    for (const c of containers) {
      for (const m of (c?.movements ?? [])) {
        events.push({
          date: m?.activityDate ?? "",
          location: `${m?.location ?? ""} ${m?.portCode ?? ""}`.trim(),
          description: m?.activityDescription ?? "",
        })
      }
    }
    if (!events.length) return null
    return { status: events[0]?.description, lastLocation: events[0]?.location, lastDate: events[0]?.date, events: events.slice(0, 15), eta: json?.eta ?? null }
  } catch { return null }
}

// ─── CMA CGM — scraping multi-étapes ────────────────────────────────────────

async function trackCMA(number: string) {
  // Étape 1 : obtenir des cookies de session via la page d'accueil
  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  }

  let cookies = ""
  try {
    const homeRes = await fetch("https://www.cma-cgm.com/ebusiness/tracking", {
      headers: browserHeaders,
      redirect: "follow",
    })
    const setCookie = homeRes.headers.get("set-cookie")
    if (setCookie) {
      cookies = setCookie.split(",").map(c => c.split(";")[0].trim()).join("; ")
    }
  } catch { /* ignore, try without cookies */ }

  // Étape 2 : appeler l'API JSON avec les cookies
  const apiHeaders = {
    ...browserHeaders,
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://www.cma-cgm.com/ebusiness/tracking/search",
    ...(cookies ? { "Cookie": cookies } : {}),
  }

  // Essayer plusieurs endpoints et formats de numéro
  const endpoints = [
    `https://www.cma-cgm.com/ebusiness/tracking/json?numero=${encodeURIComponent(number)}`,
    `https://www.cma-cgm.com/ebusiness/tracking/json?numero=${encodeURIComponent(number)}&type=container`,
    `https://www.cma-cgm.com/ebusiness/tracking/json?numero=${encodeURIComponent(number)}&type=bl`,
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: apiHeaders })
      if (!res.ok) continue
      const text = await res.text()
      if (!text || text.trim() === "" || text.trim() === "null") continue
      let json: any = null
      try { json = JSON.parse(text) } catch { continue }
      const parsed = parseCMA(json)
      if (parsed) return NextResponse.json({ carrier: "CMA CGM", parsed })
    } catch { continue }
  }

  // Étape 3 : scraper le HTML comme fallback
  try {
    const htmlRes = await fetch(
      `https://www.cma-cgm.com/ebusiness/tracking/search?numero=${encodeURIComponent(number)}`,
      { headers: { ...browserHeaders, ...(cookies ? { "Cookie": cookies } : {}) } }
    )
    const html = await htmlRes.text()
    const parsed = parseCMAHtml(html, number)
    if (parsed) return NextResponse.json({ carrier: "CMA CGM", parsed })
  } catch { /* ignore */ }

  return NextResponse.json({
    carrier: "CMA CGM",
    parsed: null,
    error: "CMA CGM bloque les requêtes automatiques depuis les serveurs cloud. Utilisez le bouton ↗ Tracker.",
  })
}

function parseCMA(json: any) {
  if (!json || typeof json !== "object") return null
  try {
    const events: { date: string; location: string; description: string }[] = []
    const containers = json?.containers ?? json?.tracking?.containers ?? json?.data?.containers ?? []
    for (const c of containers) {
      for (const m of (c?.events ?? c?.movements ?? [])) {
        events.push({
          date: m?.eventDate ?? m?.date ?? m?.activityDate ?? "",
          location: m?.location ?? m?.port ?? m?.portName ?? "",
          description: m?.eventDescription ?? m?.description ?? m?.activityDescription ?? "",
        })
      }
    }
    if (!events.length) return null
    return { status: events[0]?.description, lastLocation: events[0]?.location, lastDate: events[0]?.date, events: events.slice(0, 15), eta: json?.eta ?? json?.estimatedArrival ?? null }
  } catch { return null }
}

function parseCMAHtml(html: string, number: string) {
  // Extraire les données JSON embarquées dans le HTML
  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?})(?:<\/script>|;)/s)
    ?? html.match(/data-tracking="([^"]+)"/)
    ?? html.match(/"trackingResults"\s*:\s*(\[.+?\])/s)

  if (!jsonMatch) return null
  try {
    const json = JSON.parse(jsonMatch[1].replace(/&quot;/g, '"'))
    return parseCMA(json)
  } catch { return null }
}
