import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`

async function sendTelegram(text: string) {
  await fetch(TELEGRAM_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
    }),
  })
}

function fmt(n: number, currency = "GNF") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}

export async function GET(req: Request) {
  // Protect the cron endpoint
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const db = admin.schema("geg_guinee")

  // Yesterday's date range
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const from = yesterday.toISOString().slice(0, 10) // YYYY-MM-DD
  const to = now.toISOString().slice(0, 10)

  // Montant facturé hier (invoices created yesterday)
  const { data: invoices } = await db
    .from("invoices")
    .select("total_ht, currency")
    .gte("created_at", `${from}T00:00:00`)
    .lt("created_at", `${to}T00:00:00`)

  const facture = invoices?.reduce((s, i) => s + Number(i.total_ht ?? 0), 0) ?? 0
  const nbFactures = invoices?.length ?? 0

  // Montant encaissé hier (payments received yesterday)
  const { data: payments } = await db
    .from("invoice_payments")
    .select("amount, currency")
    .gte("payment_date", from)
    .lt("payment_date", to)

  const encaisse = payments?.reduce((s, p) => s + Number(p.amount ?? 0), 0) ?? 0
  const nbPaiements = payments?.length ?? 0

  // Devis créés hier
  const { data: devis } = await db
    .from("sales_orders")
    .select("total_ht")
    .eq("status", "draft")
    .gte("created_at", `${from}T00:00:00`)
    .lt("created_at", `${to}T00:00:00`)

  const nbDevis = devis?.length ?? 0

  const dateStr = yesterday.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  const message = `📊 <b>Rapport GEG Guinée — ${dateStr}</b>

🧾 <b>Facturé</b>
${nbFactures === 0 ? "Aucune facture" : `${nbFactures} facture${nbFactures > 1 ? "s" : ""} · ${fmt(facture)}`}

💰 <b>Encaissé</b>
${nbPaiements === 0 ? "Aucun paiement" : `${nbPaiements} paiement${nbPaiements > 1 ? "s" : ""} · ${fmt(encaisse)}`}

📝 <b>Devis créés</b>
${nbDevis === 0 ? "Aucun devis" : `${nbDevis} devis`}`

  await sendTelegram(message)

  return NextResponse.json({ ok: true, facture, encaisse, nbFactures, nbPaiements })
}
