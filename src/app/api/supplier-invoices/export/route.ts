import { NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function GET() {
  const { db } = await createCompanyClient()
  const { data: invoices } = await db
    .from("supplier_invoices")
    .select("number, supplier_name, invoice_date, due_date, total_ht, tax_amount, total_ttc, total_paid, balance, status, currency, reference")
    .order("invoice_date", { ascending: false })

  const STATUS: Record<string, string> = {
    draft: "Brouillon", pending: "En attente", paid: "Payée", partial: "Partielle", cancelled: "Annulée",
  }

  const rows = (invoices ?? []).map(i => [
    i.number ?? "",
    i.supplier_name ?? "",
    i.invoice_date ?? "",
    i.due_date ?? "",
    i.currency ?? "",
    Number(i.total_ht).toFixed(2),
    Number(i.tax_amount).toFixed(2),
    Number(i.total_ttc).toFixed(2),
    Number(i.total_paid).toFixed(2),
    Number(i.balance).toFixed(2),
    STATUS[i.status] ?? i.status ?? "",
    i.reference ?? "",
  ])

  const headers = ["Numéro", "Fournisseur", "Date", "Échéance", "Devise", "Total HT", "TVA", "Total TTC", "Payé", "Solde", "Statut", "Référence"]
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="factures-fournisseurs.csv"`,
    },
  })
}
