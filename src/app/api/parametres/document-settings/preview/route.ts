import { NextRequest, NextResponse } from "next/server"
import { renderFacturePdf } from "@/app/api/factures/[id]/pdf/renderFacturePdf"

export const maxDuration = 60
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const ds = await req.json()

    const buf = await renderFacturePdf({
      number: "FAC-2026-APERÇU",
      status: "sent",
      currency: "GNF",
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      notes: "Ceci est un aperçu de vos paramètres de document.",
      accountName: "Client Exemple SARL",
      accountCity: "Conakry",
      accountCountry: "Guinée",
      accountPhone: "+224 600 000 000",
      lines: [
        { id: "1", description: "Produit A – Lubrifiant industriel 200L", quantity: 5, unit_price: 2500000, discount: 0, tva_rate: 18 },
        { id: "2", description: "Produit B – Hydraulic HLP 68", quantity: 2, unit_price: 6300000, discount: 10, tva_rate: 18 },
        { id: "3", description: "Frais de livraison", quantity: 1, unit_price: 500000, discount: 0, tva_rate: 0 },
      ],
      payments: [],
      qrDataUrl: null,
      bankAccounts: [],
      docSettings: ds,
    })

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=apercu.pdf",
      },
    })
  } catch (err) {
    console.error("Preview PDF error:", err)
    return NextResponse.json({ error: "Erreur génération PDF" }, { status: 500 })
  }
}
