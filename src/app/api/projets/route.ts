import { NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export async function GET() {
  try {
    const { db } = await createCompanyClient()

    // Tous les devis avec leurs lignes
    const { data: orders, error: ordErr } = await db
      .from("sales_orders")
      .select("id, number, status, currency, date_order, project_code, commission_client, account:account_id(name), salesperson:salesperson_id(full_name)")
      .neq("status", "cancelled")
      .order("date_order", { ascending: false })

    if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 400 })

    const { data: orderLines } = await db
      .from("sales_order_lines")
      .select("order_id, quantity, unit_price, discount")

    // Toutes les factures avec paiements
    const { data: invoices } = await db
      .from("invoices")
      .select("id, order_id, status, currency")

    const { data: payments } = await db
      .from("payments")
      .select("invoice_id, amount_in_invoice_currency, amount, currency")

    // Tous les achats avec lignes et coûts
    const { data: purchaseOrders } = await db
      .from("purchase_orders")
      .select("id, number, status, currency, order_date, project_code, supplier_name, freight_cost, insurance_cost")
      .neq("status", "cancelled")

    const { data: purchaseLines } = await db
      .from("purchase_order_lines")
      .select("order_id, quantity, fob_unit_price")

    const { data: purchaseCosts } = await db
      .from("purchase_costs")
      .select("order_id, amount, currency")

    // Calcul montant HT par devis
    const linesByOrder = new Map<string, number>()
    for (const l of orderLines ?? []) {
      const ht = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (1 - (Number(l.discount) || 0) / 100)
      linesByOrder.set(l.order_id, (linesByOrder.get(l.order_id) ?? 0) + ht)
    }

    // Paiements par facture
    const paidByInvoice = new Map<string, number>()
    for (const p of payments ?? []) {
      const amt = Number(p.amount_in_invoice_currency ?? p.amount) || 0
      paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + amt)
    }

    // CA encaissé par order_id (via invoices)
    const encaisseByOrder = new Map<string, number>()
    for (const inv of invoices ?? []) {
      if (!inv.order_id) continue
      const paid = paidByInvoice.get(inv.id) ?? 0
      encaisseByOrder.set(inv.order_id, (encaisseByOrder.get(inv.order_id) ?? 0) + paid)
    }

    // Achats montant FOB par PO
    const fobByPO = new Map<string, number>()
    for (const l of purchaseLines ?? []) {
      const fob = (Number(l.quantity) || 0) * (Number(l.fob_unit_price) || 0)
      fobByPO.set(l.order_id, (fobByPO.get(l.order_id) ?? 0) + fob)
    }

    // Coûts annexes par PO (fret + assurance + purchase_costs)
    const costsByPO = new Map<string, number>()
    for (const po of purchaseOrders ?? []) {
      const base = (Number(po.freight_cost) || 0) + (Number(po.insurance_cost) || 0)
      costsByPO.set(po.id, base)
    }
    for (const c of purchaseCosts ?? []) {
      costsByPO.set(c.order_id, (costsByPO.get(c.order_id) ?? 0) + (Number(c.amount) || 0))
    }

    // Grouper par project_code
    const PROJECT_LABELS: Record<string, string> = {
      "GEG-GUI": "GEG Guinée",
      "GEG-SING": "GEG Singapour",
      "VALOIL": "ValOil",
      "AUTRE": "Autre",
    }

    const projectMap = new Map<string, {
      code: string
      label: string
      devis: typeof orders
      achats: typeof purchaseOrders
      ca_ht: number
      encaisse: number
      cout_achat: number
      marge: number
    }>()

    // Initialiser tous les projets connus
    for (const code of Object.keys(PROJECT_LABELS)) {
      projectMap.set(code, {
        code, label: PROJECT_LABELS[code],
        devis: [], achats: [],
        ca_ht: 0, encaisse: 0, cout_achat: 0, marge: 0,
      })
    }

    for (const so of orders ?? []) {
      const code = so.project_code ?? "SANS_PROJET"
      if (!projectMap.has(code)) {
        projectMap.set(code, {
          code, label: PROJECT_LABELS[code] ?? code,
          devis: [], achats: [],
          ca_ht: 0, encaisse: 0, cout_achat: 0, marge: 0,
        })
      }
      const proj = projectMap.get(code)!
      proj.devis.push(so)
      proj.ca_ht += linesByOrder.get(so.id) ?? 0
      proj.encaisse += encaisseByOrder.get(so.id) ?? 0
    }

    for (const po of purchaseOrders ?? []) {
      const code = po.project_code ?? "SANS_PROJET"
      if (!projectMap.has(code)) {
        projectMap.set(code, {
          code, label: PROJECT_LABELS[code] ?? code,
          devis: [], achats: [],
          ca_ht: 0, encaisse: 0, cout_achat: 0, marge: 0,
        })
      }
      const proj = projectMap.get(code)!
      proj.achats?.push(po)
      proj.cout_achat += (fobByPO.get(po.id) ?? 0) + (costsByPO.get(po.id) ?? 0)
    }

    // Calcul marge
    for (const proj of projectMap.values()) {
      proj.marge = proj.ca_ht - proj.cout_achat
    }

    // Retirer les projets vides (sauf ceux prédéfinis avec activité)
    const projects = Array.from(projectMap.values())
      .filter(p => (p.devis?.length ?? 0) > 0 || (p.achats?.length ?? 0) > 0)
      .sort((a, b) => b.ca_ht - a.ca_ht)

    return NextResponse.json({ projects })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
