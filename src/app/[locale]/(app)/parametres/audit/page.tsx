import Link from "next/link"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAccess, hasPermission } from "@/lib/access"
import { isSuperAdmin } from "@/lib/roles"

const MODULES: Record<string, string> = {
  crm: "CRM", ventes: "Ventes", achats: "Achats", comptabilite: "Comptabilité", stock: "Stock",
  equipe: "Équipe", parametres: "Paramètres", droits: "Droits", acces: "Accès", api: "Refus API", page: "Refus page",
}
const ORIGINS: Record<string, string> = { utilisateur: "Utilisateur", api: "Accès direct", automatisation: "Automatisation", systeme: "Système" }
const PAGE_SIZE = 100

type Search = { module?: string; action?: string; user?: string; entity?: string; from?: string; to?: string; page?: string }

// General audit log (plan §7): read only, reserved to "journal.voir" — Super admin: everything; Admin: his companies
export default async function AuditPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params
  const sp = await searchParams
  const access = await getAccess()
  if (!access || !(await hasPermission("journal.voir"))) redirect(`/${locale}/dashboard`)

  const admin = createAdminClient()
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1)
  let q = admin.from("audit_events")
    .select("id, occurred_at, actor_id, origin, company, module, action, entity_type, entity_id, entity_label, old_values, new_values, parent_event_id", { count: "exact" })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (!isSuperAdmin(access.role)) q = q.in("company", access.schemas)
  if (sp.module) q = q.eq("module", sp.module)
  if (sp.action) q = q.ilike("action", `%${sp.action}%`)
  if (sp.user) q = q.eq("actor_id", sp.user)
  if (sp.entity) q = q.or(`entity_label.ilike.%${sp.entity.replace(/[,()]/g, "")}%,entity_id.eq.${sp.entity.replace(/[,()]/g, "")}`)
  if (sp.from) q = q.gte("occurred_at", sp.from)
  if (sp.to) q = q.lte("occurred_at", `${sp.to}T23:59:59`)
  const [{ data: events, count }, { data: people }] = await Promise.all([
    q, admin.from("profiles").select("id, full_name, email").order("full_name"),
  ])
  const name = (id: string | null) => !id ? "—" : people?.find(p => p.id === id)?.full_name || people?.find(p => p.id === id)?.email || id.slice(0, 8)
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const link = (p: number) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), page: String(p) })}`
  const field = "px-2 py-1.5 text-sm border border-gray-200 rounded-lg"

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Journal d&apos;audit</h1>
      <p className="text-sm text-gray-500 mb-4">Toutes les actions enregistrées par la base : qui, quand, société, document, avant → après. Le journal ne peut être ni modifié ni supprimé.</p>

      <form className="flex flex-wrap items-end gap-2 mb-4 bg-white border border-gray-100 rounded-xl p-3">
        <select name="module" defaultValue={sp.module ?? ""} className={field}>
          <option value="">Tous les modules</option>
          {Object.entries(MODULES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="user" defaultValue={sp.user ?? ""} className={field}>
          <option value="">Toutes les personnes</option>
          {(people ?? []).map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
        </select>
        <input name="action" defaultValue={sp.action ?? ""} placeholder="Action (ex. annulation)" className={field} />
        <input name="entity" defaultValue={sp.entity ?? ""} placeholder="Document (ex. FAC-2026)" className={field} />
        <input type="date" name="from" defaultValue={sp.from ?? ""} className={field} />
        <input type="date" name="to" defaultValue={sp.to ?? ""} className={field} />
        <button className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg">Filtrer</button>
        <Link href="?" className="px-3 py-1.5 text-sm text-gray-500">Effacer</Link>
      </form>

      <div className="bg-white border border-gray-100 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Qui</th><th className="text-left px-3 py-2">Origine</th>
              <th className="text-left px-3 py-2">Société</th><th className="text-left px-3 py-2">Module</th><th className="text-left px-3 py-2">Action</th>
              <th className="text-left px-3 py-2">Document</th><th className="text-left px-3 py-2">Avant → après</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(events ?? []).map(e => (
              <tr key={e.id} className="align-top">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(e.occurred_at).toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2">{name(e.actor_id)}</td>
                <td className="px-3 py-2">{ORIGINS[e.origin] ?? e.origin}{e.parent_event_id ? <span className="text-gray-400"> · suite de #{e.parent_event_id}</span> : null}</td>
                <td className="px-3 py-2">{e.company === "geg_guinee" ? "Guinée" : e.company === "geg_singapore" ? "Singapore" : "—"}</td>
                <td className="px-3 py-2">{MODULES[e.module] ?? e.module}</td>
                <td className="px-3 py-2 font-medium">{e.action}</td>
                <td className="px-3 py-2">{e.entity_type}{e.entity_label ? ` · ${e.entity_label}` : ""}</td>
                <td className="px-3 py-2 max-w-md break-all text-gray-600">
                  {e.old_values ? <span className="text-red-600">{JSON.stringify(e.old_values).slice(0, 300)}</span> : null}
                  {e.old_values && e.new_values ? " → " : null}
                  {e.new_values ? <span className="text-emerald-700">{JSON.stringify(e.new_values).slice(0, 300)}</span> : null}
                </td>
              </tr>
            ))}
            {!events?.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Aucun événement</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
        <span>{count ?? 0} événement(s)</span>
        <span className="flex gap-3">
          {page > 1 && <Link href={link(page - 1)}>← Précédent</Link>}
          <span>Page {page} / {pages}</span>
          {page < pages && <Link href={link(page + 1)}>Suivant →</Link>}
        </span>
      </div>
    </div>
  )
}
