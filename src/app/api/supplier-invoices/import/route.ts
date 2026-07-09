import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

// POST: import supplier invoices from CSV
// Expected CSV columns: supplier_name, currency, invoice_date, due_date, reference, total_ht, tax_amount, total_ttc
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { rows } = body as { rows: Record<string, string>[] }

  if (!rows?.length) return NextResponse.json({ error: "Aucune ligne à importer" }, { status: 400 })

  const { db } = await createCompanyClient()
  const { count: baseCount } = await db.from("supplier_invoices").select("id", { count: "exact", head: true })

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")

  const toInsert = rows.map((r, i) => {
    const seq = String((baseCount ?? 0) + i + 1).padStart(4, "0")
    const total_ht = parseFloat(r.total_ht ?? r["Total HT"] ?? "0") || 0
    const tax_amount = parseFloat(r.tax_amount ?? r["TVA"] ?? "0") || 0
    const total_ttc = parseFloat(r.total_ttc ?? r["Total TTC"] ?? String(total_ht + tax_amount)) || 0
    return {
      number: r.number ?? r["Numéro"] ?? `FF-${year}-${month}-${seq}`,
      supplier_name: (r.supplier_name ?? r["Fournisseur"] ?? "").trim(),
      currency: r.currency ?? r["Devise"] ?? "GNF",
      invoice_date: r.invoice_date ?? r["Date"] ?? now.toISOString().split("T")[0],
      due_date: (r.due_date ?? r["Échéance"] ?? null) || null,
      reference: (r.reference ?? r["Référence"] ?? null) || null,
      notes: (r.notes ?? r["Notes"] ?? null) || null,
      total_ht,
      tax_amount,
      total_ttc,
      status: "pending",
    }
  }).filter(r => r.supplier_name)

  if (!toInsert.length) return NextResponse.json({ error: "Aucune ligne valide (colonne fournisseur manquante)" }, { status: 400 })

  const { data, error } = await db.from("supplier_invoices").insert(toInsert).select("id, number")
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ imported: data?.length ?? 0, invoices: data })
}
