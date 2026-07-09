import { NextRequest, NextResponse } from "next/server"
import { getCompanySchema } from "@/lib/company"
import { createClient as createAdminClient } from "@supabase/supabase-js"

async function fetchTransactions(accountId: string | null) {
  const schema = await getCompanySchema()
  const raw = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (raw as any).schema(schema) as typeof raw

  let query = db
    .from("treasury_transactions")
    .select("date, description, reference, category, type, amount, currency")
    .order("date", { ascending: false })

  if (accountId) query = query.eq("account_id", accountId)

  const { data } = await query
  return data ?? []
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format") ?? "csv"
  const accountId = searchParams.get("account_id") ?? null
  const accountName = searchParams.get("account_name") ?? "tresorerie"

  const rows = await fetchTransactions(accountId)

  const TYPE_LABEL: Record<string, string> = {
    credit: "Entrée", debit: "Sortie", transfer_in: "Virement reçu", transfer_out: "Virement émis",
  }

  const headers = ["Date", "Description", "Référence", "Catégorie", "Type", "Montant", "Devise"]
  const data = rows.map(r => [
    r.date ? new Date(r.date).toLocaleDateString("fr") : "",
    r.description ?? "",
    r.reference ?? "",
    r.category ?? "",
    TYPE_LABEL[r.type] ?? r.type ?? "",
    (r.type === "credit" || r.type === "transfer_in" ? "+" : "-") + Number(r.amount).toFixed(2),
    r.currency ?? "",
  ])

  const filename = `mouvements-${accountName.replace(/\s+/g, "-").toLowerCase()}`

  if (format === "csv") {
    const csv = [headers, ...data]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    })
  }

  if (format === "xls") {
    // Simple HTML table that Excel can open as .xls
    const tableRows = data.map(row =>
      `<tr>${row.map(v => `<td>${String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`).join("")}</tr>`
    ).join("")
    const xls = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Mouvements">
<Table>
<Row>${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join("")}</Row>
${data.map(row => `<Row>${row.map(v => `<Cell><Data ss:Type="String">${String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Data></Cell>`).join("")}</Row>`).join("\n")}
</Table>
</Worksheet>
</Workbook>`
    return new NextResponse(xls, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.xls"`,
      },
    })
  }

  if (format === "pdf") {
    const totalIn = rows.filter(r => r.type === "credit" || r.type === "transfer_in").reduce((s, r) => s + Number(r.amount), 0)
    const totalOut = rows.filter(r => r.type === "debit" || r.type === "transfer_out").reduce((s, r) => s + Number(r.amount), 0)
    const currency = rows[0]?.currency ?? "GNF"

    const tableRows = data.map(([date, desc, ref, cat, type, amount, cur], i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#666;font-size:12px;white-space:nowrap">${date}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px"><strong>${desc}</strong>${ref ? `<br><span style="font-size:11px;color:#999">${ref}</span>` : ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#888;font-size:12px">${cat}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;font-size:13px;color:${amount.startsWith("+") ? "#059669" : "#dc2626"};white-space:nowrap">${amount} ${cur}</td>
      </tr>`).join("")

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Mouvements — ${accountName}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #111; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
  .summary { display: flex; gap: 24px; margin-bottom: 24px; }
  .card { background: #f9fafb; border-radius: 8px; padding: 12px 20px; }
  .card-label { font-size: 11px; text-transform: uppercase; color: #888; }
  .card-value { font-size: 18px; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead { background: #1e3a5f; color: white; }
  thead th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  thead th:last-child { text-align: right; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <h1>Mouvements — ${accountName}</h1>
  <p class="sub">Exporté le ${new Date().toLocaleDateString("fr")}</p>
  <div class="summary">
    <div class="card"><div class="card-label">Total entrées</div><div class="card-value" style="color:#059669">+${totalIn.toLocaleString("fr")} ${currency}</div></div>
    <div class="card"><div class="card-label">Total sorties</div><div class="card-value" style="color:#dc2626">−${totalOut.toLocaleString("fr")} ${currency}</div></div>
    <div class="card"><div class="card-label">Solde net</div><div class="card-value">${(totalIn - totalOut).toLocaleString("fr")} ${currency}</div></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Description</th><th>Catégorie</th><th style="text-align:right">Montant</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <script>window.onload = () => window.print()</script>
</body></html>`

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  return NextResponse.json({ error: "Format invalide" }, { status: 400 })
}
