import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSchemaFromRequest } from "@/lib/company"
import { errorResponse } from "@/lib/access"

// Temporary correction of a payment entered by mistake (decision B3), until reversals (second chantier).
// Permission "paiements.supprimer" (Managers and above) is checked by the middleware.
// public.delete_payment_safe deletes the payment and ONLY its own treasury operation, in one transaction,
// or refuses when the link is missing, inconsistent or ambiguous. Every success and refusal is audited.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  try {
    const { id, paymentId } = await params
    const schema = await getSchemaFromRequest(req)
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("delete_payment_safe", {
      p_schema: schema, p_kind: "client", p_payment_id: paymentId, p_invoice_id: id,
    })
    if (error) {
      await admin.rpc("audit_log_event", {
        p_company: schema, p_module: "comptabilite", p_action: "paiement.suppression_refusee",
        p_entity_type: "payments", p_entity_id: paymentId, p_label: null,
        p_details: { motif: error.message, facture: id },
      })
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(data)
  } catch (err) {
    return errorResponse(err)
  }
}
