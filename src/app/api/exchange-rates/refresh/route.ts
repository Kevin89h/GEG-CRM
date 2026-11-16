import { createCompanyClient } from "@/lib/company"
import { NextResponse } from "next/server"
import { errorResponse, hasPermission } from "@/lib/access"
import { refreshDocumentRates } from "@/lib/document-rates"

// Manual refresh of the document reference rates ("Actualiser les taux" button, D-08: kept).
// Same pairs and provider as before; full precision since D-07. Inserts a new dated set: existing rates and the rates
// already applied to documents and payments are never changed. Needs "parametres.gerer" (also enforced by the database).
export async function POST() {
  try {
    const { db } = await createCompanyClient()
    if (!(await hasPermission("parametres.gerer"))) {
      return NextResponse.json({ error: "Droit « paramètres » requis pour actualiser les taux" }, { status: 403 })
    }
    try {
      const { inserted, rows } = await refreshDocumentRates(db, "manual")
      return NextResponse.json({ ok: true, updated: inserted, rates: rows })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: `Échec de l'actualisation des taux : ${message}. Les derniers taux disponibles restent utilisés.` }, { status: 502 })
    }
  } catch (err) {
    return errorResponse(err)
  }
}
