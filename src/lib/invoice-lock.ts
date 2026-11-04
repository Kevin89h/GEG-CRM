// Customer invoices (decisions D1, Q2): a draft can be edited, emitted or voided; once emitted, an invoice
// can never be edited, put back to draft or voided, whatever the role — corrections go through a credit note.
// The database enforces the same rules (trigger document_rules); these checks give a clear message first.
import { NextResponse } from "next/server"
import { allows } from "@/lib/permissions"

export const LOCKED_MESSAGE = "Facture émise : elle n'est plus modifiable. Pour la corriger, créez un avoir."

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
 * Error message when these permissions don't allow moving an invoice from one status to another.
 * - draft → sent (emission): factures.emettre
 * - draft → cancelled (void of a draft): factures.annuler_brouillon
 * - sent ↔ partial ↔ paid: follows the payments (paiements_clients.enregistrer)
 * - back to draft, or voiding an emitted invoice: nobody (credit note)
 */
export function invoiceTransitionError(perms: readonly string[] | undefined, from: string, to: string): string | null {
  if (from === to) return null
  if (to === "draft") return "Une facture émise ne peut pas revenir en brouillon : créez un avoir."
  if (from === "cancelled") return "Une facture annulée ne peut plus changer de statut."
  if (from === "draft") {
    if (to === "sent") return allows(perms, "factures.emettre") ? null : "Vos permissions ne permettent pas d'émettre une facture."
    if (to === "cancelled") return allows(perms, "factures.annuler_brouillon") ? null : "Vos permissions ne permettent pas d'annuler une facture."
    return "Une facture en brouillon doit d'abord être émise."
  }
  if (to === "cancelled") return "Une facture émise ne peut pas être annulée : créez un avoir."
  return allows(perms, "paiements_clients.enregistrer") ? null : "Seul un utilisateur autorisé aux paiements modifie le statut de paiement."
}
