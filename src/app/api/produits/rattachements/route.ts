import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse, hasPermission, requirePermission } from "@/lib/access"
import { createAdminClient } from "@/lib/supabase/admin"

// Historical correspondence (decision 6 of 10/11/2026): an old FREE line of a quote or an invoice is linked to a
// catalogue product in a separate table. The documents themselves are never modified: no change of amount, VAT,
// PDF, stock nor accounting. Every link keeps its author and dates; a wrong link is cancelled (never deleted)
// and replaced by a new one. Rights: reading needs "Produits : voir" (plus the right to see the document type),
// creating, validating or cancelling needs "Produits : créer". Always within the active company.

type LineTable = "invoice_lines" | "sales_order_lines"

interface FreeLine {
  line_table: LineTable; line_id: string; document_id: string; document_number: string | null; document_status: string | null
  document_kind: "facture" | "devis"; document_date: string | null; account: string | null; currency: string | null
  description: string; quantity: number; unit_price: number
}

// GET ?status=all|unlinked|proposed|validated — free lines of the active company with their current link and history
export async function GET(req: NextRequest) {
  try {
    await requirePermission("produits.voir")
    const [seeInvoices, seeQuotes, canManage] = await Promise.all([
      hasPermission("factures.voir"), hasPermission("devis.voir"), hasPermission("produits.gerer"),
    ])
    const filter = new URL(req.url).searchParams.get("status") ?? "all"
    const { db } = await createCompanyClient()
    const lines: FreeLine[] = []

    if (seeInvoices) {
      const { data, error } = await db.from("invoice_lines")
        .select("id, description, quantity, unit_price, invoice:invoices!inner(id, number, status, issue_date, currency, account:accounts(name))")
        .is("product_id", null).eq("line_type", "product")
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const l of (data ?? []) as any[]) {
        const d = Array.isArray(l.invoice) ? l.invoice[0] : l.invoice
        const acc = Array.isArray(d?.account) ? d.account[0] : d?.account
        lines.push({ line_table: "invoice_lines", line_id: l.id, document_id: d?.id, document_number: d?.number ?? null, document_status: d?.status ?? null,
          document_kind: "facture", document_date: d?.issue_date ?? null, account: acc?.name ?? null, currency: d?.currency ?? null,
          description: l.description, quantity: Number(l.quantity), unit_price: Number(l.unit_price) })
      }
    }
    if (seeQuotes) {
      const { data, error } = await db.from("sales_order_lines")
        .select("id, description, quantity, unit_price, order:sales_orders!inner(id, number, status, date_order, currency, account:accounts(name))")
        .is("product_id", null).eq("line_type", "product")
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const l of (data ?? []) as any[]) {
        const d = Array.isArray(l.order) ? l.order[0] : l.order
        const acc = Array.isArray(d?.account) ? d.account[0] : d?.account
        lines.push({ line_table: "sales_order_lines", line_id: l.id, document_id: d?.id, document_number: d?.number ?? null, document_status: d?.status ?? null,
          document_kind: "devis", document_date: d?.date_order ?? null, account: acc?.name ?? null, currency: d?.currency ?? null,
          description: l.description, quantity: Number(l.quantity), unit_price: Number(l.unit_price) })
      }
    }

    const { data: links, error: linkErr } = await db.from("historical_line_links")
      .select("id, line_table, line_id, product_id, status, source, note, created_by, created_at, validated_by, validated_at, cancelled_by, cancelled_at, cancel_reason, product:products(id, name, product_type, is_active, to_complete)")
      .order("created_at", { ascending: true })
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 })

    // Names of the authors (profiles), never e-mails of other companies' users beyond the name
    const userIds = [...new Set((links ?? []).flatMap((l: { created_by: string | null; validated_by: string | null; cancelled_by: string | null }) => [l.created_by, l.validated_by, l.cancelled_by]).filter(Boolean))] as string[]
    const names = new Map<string, string>()
    if (userIds.length) {
      const { data: profiles } = await createAdminClient().from("profiles").select("id, full_name").in("id", userIds)
      for (const p of profiles ?? []) names.set(p.id, p.full_name ?? "")
    }
    const who = (id: string | null, source?: string) => (id ? names.get(id) || "Utilisateur" : source === "auto_h4" ? "Proposition automatique H4" : null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byLine = new Map<string, any[]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const l of (links ?? []) as any[]) {
      const k = `${l.line_table}:${l.line_id}`
      const product = Array.isArray(l.product) ? l.product[0] : l.product
      const row = { ...l, product, created_by_name: who(l.created_by, l.source), validated_by_name: who(l.validated_by), cancelled_by_name: who(l.cancelled_by) }
      byLine.set(k, [...(byLine.get(k) ?? []), row])
    }

    const rows = lines.map(l => {
      const history = byLine.get(`${l.line_table}:${l.line_id}`) ?? []
      const current = history.find(h => h.status !== "cancelled") ?? null
      return { ...l, link: current, history }
    }).filter(r =>
      filter === "all" ? true :
      filter === "unlinked" ? !r.link :
      r.link?.status === filter)
      .sort((a, b) => (a.description ?? "").localeCompare(b.description ?? "", "fr") || (a.document_number ?? "").localeCompare(b.document_number ?? ""))

    const all = lines.map(l => (byLine.get(`${l.line_table}:${l.line_id}`) ?? []).find(h => h.status !== "cancelled"))
    const summary = {
      total: lines.length,
      validated: all.filter(x => x?.status === "validated").length,
      proposed: all.filter(x => x?.status === "proposed").length,
      unlinked: all.filter(x => !x).length,
    }
    return NextResponse.json({ rows, summary, canManage })
  } catch (err) {
    return errorResponse(err)
  }
}

// POST { line_table, line_id, product_id, note? } — new link (validated: it is made by an authorised person)
export async function POST(req: NextRequest) {
  try {
    const access = await requirePermission("produits.gerer")
    const body = await req.json()
    const line_table = body.line_table as LineTable
    if (!["invoice_lines", "sales_order_lines"].includes(line_table) || !body.line_id || !body.product_id) {
      return NextResponse.json({ error: "Ligne et produit obligatoires" }, { status: 400 })
    }
    if (!(await hasPermission(line_table === "invoice_lines" ? "factures.voir" : "devis.voir"))) {
      return NextResponse.json({ error: "Votre rôle ou vos permissions ne permettent pas cette action" }, { status: 403 })
    }
    const { db } = await createCompanyClient()
    const { data: product } = await db.from("products").select("id").eq("id", body.product_id).maybeSingle()
    if (!product) return NextResponse.json({ error: "Produit introuvable dans le catalogue de cette société" }, { status: 400 })
    const now = new Date().toISOString()
    const { data, error } = await db.from("historical_line_links").insert([{
      line_table, line_id: body.line_id, product_id: body.product_id, status: "validated", source: "manual",
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
      created_by: access.userId, validated_by: access.userId, validated_at: now,
    }]).select("id, status").single()
    if (error) {
      const msg = error.message.includes("historical_line_links_one_active")
        ? "Cette ligne a déjà une correspondance : annulez-la d'abord pour la corriger"
        : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json(data)
  } catch (err) {
    return errorResponse(err)
  }
}
