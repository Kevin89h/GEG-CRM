import { NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse, requirePermission } from "@/lib/access"

const PAGE = 1000

// A2: supplier invoices CSV export. Paid amount and balance come from the totals view (computed from the
// supplier payments); every invoice is exported (read page by page, no silent truncation); a database
// error is reported instead of producing an empty file.
export async function GET()  {
  try {
    await requirePermission("factures_fournisseurs.voir")
    const { db } = await createCompanyClient()

    type Total = { id: string; number: string | null; supplier_name: string | null; invoice_date: string | null; due_date: string | null; total_ht: number | null; total_ttc: number | null; total_paid: number | null; balance: number | null; status: string; currency: string | null }
    type Extra = { id: string; tax_amount: number | null; reference: string | null }
    const totals: Total[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from("supplier_invoice_totals")
        .select("id, number, supplier_name, invoice_date, due_date, total_ht, total_ttc, total_paid, balance, status, currency")
        .order("invoice_date", { ascending: false }).order("id")
        .range(from, from + PAGE - 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      totals.push(...((data ?? []) as Total[]))
      if (!data || data.length < PAGE) break
    }
    const extra = new Map<string, Extra>()
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from("supplier_invoices").select("id, tax_amount, reference").order("id").range(from, from + PAGE - 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      for (const e of (data ?? []) as Extra[]) extra.set(e.id, e)
      if (!data || data.length < PAGE) break
    }

    const STATUS: Record<string, string> = {
      draft: "Brouillon", pending: "En attente", paid: "Payée", partial: "Partielle", cancelled: "Annulée",
    }

    const rows = totals.map(i => [
      i.number ?? "",
      i.supplier_name ?? "",
      i.invoice_date ?? "",
      i.due_date ?? "",
      i.currency ?? "",
      Number(i.total_ht ?? 0).toFixed(2),
      Number(extra.get(i.id)?.tax_amount ?? 0).toFixed(2),
      Number(i.total_ttc ?? 0).toFixed(2),
      Number(i.total_paid ?? 0).toFixed(2),
      Number(i.balance ?? 0).toFixed(2),
      STATUS[i.status] ?? i.status ?? "",
      extra.get(i.id)?.reference ?? "",
    ])

    const headers = ["Numéro", "Fournisseur", "Date", "Échéance", "Devise", "Total HT", "TVA", "Total TTC", "Payé", "Solde", "Statut", "Référence"]
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")

    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="factures-fournisseurs.csv"`,
      },
    })

  } catch (err) {
    return errorResponse(err)
  }
}
