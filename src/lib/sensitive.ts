// Sensitive fields removed on the SERVER for users without the permission (decisions E4, E5, D4).
// The database also refuses these columns to a user session (migration 20261106120000).
import { hasPermission } from "@/lib/access"

export const SENSITIVE = {
  /** Cost of an opportunity (margin): "Opportunités : voir coûts et marge" or "saisir les coûts" */
  dealCost: { keys: ["opportunites.couts_voir", "opportunites.couts_modifier"], fields: ["cost"] },
  /** Salaries: "Employés : consulter les salaires" */
  salary: { keys: ["employes.salaires"], fields: ["salary", "salary_currency"] },
  /** Purchase price and internal references of a product: "Produits : voir prix d'achat et références internes".
   *  "reference" is NOT internal: it is printed on quotes and invoices and used to find products in sales. */
  productInternal: { keys: ["produits.prix_achat"], fields: ["buy_price", "buy_price_currency", "sku", "internal_notes"] },
} as const

type Rule = (typeof SENSITIVE)[keyof typeof SENSITIVE]

/** Sets the sensitive fields to null on one row or a list of rows */
export function blank<T>(data: T, fields: readonly string[]): T {
  if (Array.isArray(data)) return data.map(d => blank(d, fields)) as T
  if (!data || typeof data !== "object") return data
  const copy = { ...(data as Record<string, unknown>) }
  for (const f of fields) if (f in copy) copy[f] = null
  return copy as T
}

/** Returns a filter that blanks the rule's fields unless the current user holds one of its keys */
export async function sensitiveFilter(rule: Rule): Promise<{ allowed: boolean; apply: <T>(data: T) => T }> {
  const allowed = await hasPermission([...rule.keys])
  return { allowed, apply: <T,>(data: T) => (allowed ? data : blank(data, rule.fields)) }
}

/** True when the request body tries to write one of the rule's fields */
export function writesAny(body: Record<string, unknown> | null | undefined, rule: Rule): boolean {
  return !!body && rule.fields.some(f => f in body)
}
