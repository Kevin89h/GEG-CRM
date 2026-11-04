// Emitted invoices are locked (decision D1): once an invoice leaves "draft", its lines, VAT,
// customer and dates can no longer change, for every role. Corrections go through a credit note
// (Manager and above). The database enforces the same rule (trigger invoice_lock, see migration
// 20261105120000_roles_permissions.sql); these checks only give a clear message first.
import { NextResponse } from "next/server"
import { can } from "@/lib/permissions"

export const LOCKED_MESSAGE = "Facture émise : elle n'est plus modifiable. Pour la corriger, un manager crée un avoir."

type Db = { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

export async function invoiceStatus(db: Db, invoiceId: string): Promise<string | null> {
  const { data } = await db.from("invoices").select("status").eq("id", invoiceId).single()
  return data?.status ?? null
}

/** 409 response when the invoice is not a draft any more, null when it may still be edited. */
export async function lockedInvoiceResponse(db: Db, invoiceId: string): Promise<Response | null> {
  const status = await invoiceStatus(db, invoiceId)
  if (!status) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
  return status === "draft" ? null : NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 })
}

/**
 * Error message when this role may not move an invoice from one status to another, null when allowed.
 * - draft → sent (emission) or cancelled: commercials and above
 * - sent ↔ partial ↔ paid: follows payments, Manager and above
 * - sent / partial → cancelled: Manager and above (until cancellations go through credit notes only)
 * - back to draft, or cancelling a paid invoice: nobody
 */
export function invoiceTransitionError(role: string | null | undefined, from: string, to: string): string | null {
  if (from === to) return null
  if (to === "draft") return "Une facture émise ne peut pas revenir en brouillon : passez par un avoir."
  if (from === "cancelled") return "Une facture annulée ne peut plus changer de statut."
  if (from === "draft") {
    if (to === "sent" || to === "cancelled") return can(role, "sales.write") ? null : "Votre rôle ne permet pas cette action"
    return can(role, "payments.write") ? null : "Seul un manager enregistre un paiement."
  }
  if (to === "cancelled") {
    if (from === "paid") return "Une facture payée ne peut pas être annulée : passez par un avoir."
    return can(role, "sales.correct") ? null : "Seul un manager peut annuler une facture émise (ou créer un avoir)."
  }
  return can(role, "payments.write") ? null : "Seul un manager modifie le statut de paiement."
}
