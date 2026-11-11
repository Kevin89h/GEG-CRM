import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { consolidate, fxCaption, getMarketRates, sumByCurrency } from "@/lib/fx"

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

export async function GET(req: Request)  {
  try {
    const auth = req.headers.get("authorization")
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
    const from = yesterday.toISOString().slice(0, 10)
    const to = now.toISOString().slice(0, 10)

    // G1: amounts per ORIGINAL currency (never added together) + total in EUR at the latest market rates (steering only)
    const fx = await getMarketRates()
    const line = (by: Record<string, number>) => {
      const e = Object.entries(by).filter(([, v]) => v !== 0)
      if (!e.length) return fmt(0)
      const c = consolidate(by, fx)
      const eur = e.length === 1 && e[0][0] === "EUR" ? "" : c.eur !== null ? `
≈ ${fmt(c.eur, "EUR")} au total` : `
Total EUR indisponible (taux manquant : ${c.missing.join(", ")})`
      return e.map(([cur, v]) => fmt(v, cur)).join(" · ") + eur
    }

    // 1. Montant facturé hier (factures émises datées d'hier)
    const { data: invoices } = await db
      .from("invoice_totals")
      .select("total_ht, currency, status")
      .eq("issue_date", from)
      .not("status", "in", "(draft,cancelled)")
    const facture = sumByCurrency(invoices, i => Number(i.total_ht), i => i.currency)
    const nbFactures = invoices?.length ?? 0

    // 2. Montant encaissé hier (montant et devise du paiement)
    const { data: payments } = await db
      .from("payments")
      .select("amount, currency")
      .gte("paid_at", `${from}T00:00:00`)
      .lt("paid_at", `${to}T00:00:00`)
    const encaisse = sumByCurrency(payments, p => Number(p.amount), p => p.currency)
    const nbPaiements = payments?.length ?? 0

    // 3. Factures ouvertes à encaisser (émises ou partiellement payées)
    const { data: openInvoices } = await db
      .from("invoice_totals")
      .select("balance, currency")
      .in("status", ["sent", "partial"])
    const aEncaisser = sumByCurrency(openInvoices, i => Number(i.balance), i => i.currency)
    const nbOpen = openInvoices?.length ?? 0

    // 4. Valeur du stock au prix de revient, dans la devise d'achat (comme le tableau de bord)
    const { data: stockLevels } = await db
      .from("stock_levels")
      .select("quantity, product:products(buy_price, buy_price_currency)")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prod = (sl: any) => (Array.isArray(sl.product) ? sl.product[0] : sl.product) as { buy_price?: number | null; buy_price_currency?: string | null } | null
    const valeurStock = sumByCurrency(stockLevels, sl => Number(sl.quantity ?? 0) * Number(prod(sl)?.buy_price ?? 0), sl => prod(sl)?.buy_price_currency ?? "GNF")

    // 5. Trésorerie : solde des comptes actifs, par devise
    const { data: accounts } = await db
      .from("treasury_balances")
      .select("balance, currency")
      .eq("is_active", true)
    const tresorerie = sumByCurrency(accounts, a => Number(a.balance), a => a.currency)

    // 6. Devis créés hier
    const { data: devis } = await db
      .from("sales_orders")
      .select("id")
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

  🧾 <b>Facturé hier</b>
  ${nbFactures === 0 ? "Aucune facture" : `${nbFactures} facture${nbFactures > 1 ? "s" : ""} · ${line(facture)}`}

  💰 <b>Encaissé hier</b>
  ${nbPaiements === 0 ? "Aucun paiement" : `${nbPaiements} paiement${nbPaiements > 1 ? "s" : ""} · ${line(encaisse)}`}

  ⏳ <b>Factures à encaisser</b>
  ${nbOpen === 0 ? "Aucune facture ouverte" : `${nbOpen} facture${nbOpen > 1 ? "s" : ""} · ${line(aEncaisser)}`}

  📦 <b>Valeur du stock (prix de revient)</b>
  ${line(valeurStock)}

  🏦 <b>Trésorerie</b>
  ${line(tresorerie)}

  📝 <b>Devis créés hier</b>
  ${nbDevis === 0 ? "Aucun devis" : `${nbDevis} devis`}

  <i>${fxCaption(fx)}</i>`

    // ?dry=1: returns the report without sending it (checks)
    if (new URL(req.url).searchParams.get("dry") === "1") {
      return NextResponse.json({ ok: true, dry: true, message, facture, encaisse, aEncaisser, valeurStock, tresorerie, nbFactures, nbPaiements, nbOpen, nbDevis })
    }

    await sendTelegram(message)

    return NextResponse.json({
      ok: true,
      facture,
      encaisse,
      aEncaisser,
      valeurStock,
      tresorerie,
      nbFactures,
      nbPaiements,
      nbOpen,
    })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
