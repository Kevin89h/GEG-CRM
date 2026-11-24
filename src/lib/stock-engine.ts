// Calls to the atomic stock engine (database functions of migration 20261124120000_stock_moteur_atomique.sql).
// Each operation runs in ONE transaction in the database: stocks are locked, everything is checked before writing,
// a refusal cancels everything. Business refusals come back with hint "GEG_REFUS", a precise French message and a
// JSON detail (shortages, changed stocks...). Permissions are checked by the routes BEFORE calling the engine.
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { rpc: (fn: string, args: Record<string, unknown>) => any }

export type EngineResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

/** Calls an engine function; a refusal becomes a 409 (422 for a stock shortage) with the message and its detail. */
export async function stockEngine<T = Record<string, unknown>>(db: Db, fn: string, args: Record<string, unknown>): Promise<EngineResult<T>> {
  const { data, error } = await db.rpc(fn, args)
  if (!error) return { ok: true, data: data as T }
  if (error.hint === "GEG_REFUS") {
    let detail: Record<string, unknown> = {}
    try { detail = JSON.parse(error.details ?? "{}") } catch { /* plain text detail */ }
    const status = detail.shortage || detail.shortages ? 422 : 409
    return { ok: false, response: NextResponse.json({ error: error.message, ...detail }, { status }) }
  }
  // a second write for the same document line (double click, replay) is stopped by the unique index
  if (/stock_moves_une_ecriture_par_ligne/.test(error.message ?? "")) {
    return { ok: false, response: NextResponse.json({ error: "Cette opération a déjà été enregistrée : rien n'a été fait une seconde fois." }, { status: 409 }) }
  }
  if (/stock_levels_jamais_negatif/.test(error.message ?? "")) {
    return { ok: false, response: NextResponse.json({ error: "Le stock ne peut pas devenir négatif. Rien n'a été enregistré." }, { status: 422 }) }
  }
  return { ok: false, response: NextResponse.json({ error: error.message ?? "Erreur du moteur de stock" }, { status: 400 }) }
}

/** Readable message of a database refusal raised by a trigger (e.g. purchase check at invoice emission). */
export function dbErrorBody(error: { message?: string; details?: string | null; hint?: string | null }) {
  if (error.hint === "GEG_REFUS") {
    try { return { error: error.message, ...JSON.parse(error.details ?? "{}") } } catch { /* plain detail */ }
  }
  return { error: error.message }
}
