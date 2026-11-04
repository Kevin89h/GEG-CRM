// Who is acting, passed to the database with every server-side (service role) call, so that the
// audit triggers record the real user (see public.audit_context in the permissions migration).
// The session cookie was already verified by the middleware before any route or page runs.
import { cookies, headers } from "next/headers"

function actorFromCookies(all: { name: string; value: string }[]): string | null {
  const parts = all
    .filter(c => /^sb-[a-z0-9]+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
  if (!parts.length) return null
  let raw = parts.map(p => p.value).join("")
  try {
    if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice(7), "base64url").toString("utf8")
    const session = JSON.parse(raw) as { access_token?: string }
    const payload = session.access_token?.split(".")[1]
    if (!payload) return null
    const sub = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).sub
    return typeof sub === "string" ? sub : null
  } catch {
    return null
  }
}

/** Headers describing the actor of the current request; outside a request: an automation. */
export async function auditHeaders(): Promise<Record<string, string>> {
  try {
    const [store, h] = await Promise.all([cookies(), headers()])
    const actor = actorFromCookies(store.getAll())
    const request = h.get("x-vercel-id") ?? h.get("x-request-id") ?? crypto.randomUUID()
    return actor
      ? { "x-geg-actor": actor, "x-geg-origin": "utilisateur", "x-geg-request": request }
      : { "x-geg-origin": "automatisation", "x-geg-request": request }
  } catch {
    return { "x-geg-origin": "automatisation" }
  }
}
