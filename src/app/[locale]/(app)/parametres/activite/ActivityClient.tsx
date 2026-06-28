"use client"

import { useState, useEffect, useCallback } from "react"
import { Activity, User, Clock, Filter, RefreshCw, Search, LogIn, FileText, Package, Users, DollarSign, Settings, ShoppingCart } from "lucide-react"

interface LogEntry {
  id: string
  user_id: string | null
  user_email: string | null
  user_name: string | null
  action: string
  resource: string
  resource_id: string | null
  label: string
  details: Record<string, unknown> | null
  created_at: string
}

interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
}

interface Props {
  users: UserProfile[]
  lastLogins: Record<string, string>
}

const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  login:    { label: "Connexion",    color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  create:   { label: "Création",     color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  update:   { label: "Modification", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  delete:   { label: "Suppression",  color: "text-red-700",    bg: "bg-red-50 border-red-200" },
  payment:  { label: "Paiement",     color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  send:     { label: "Envoi",        color: "text-sky-700",    bg: "bg-sky-50 border-sky-200" },
  cancel:   { label: "Annulation",   color: "text-red-700",    bg: "bg-red-50 border-red-200" },
  export:   { label: "Export",       color: "text-gray-700",   bg: "bg-gray-50 border-gray-200" },
  view:     { label: "Consultation", color: "text-gray-600",   bg: "bg-gray-50 border-gray-100" },
}

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  invoice:        <FileText size={14} />,
  devis:          <FileText size={14} />,
  achat:          <ShoppingCart size={14} />,
  payment:        <DollarSign size={14} />,
  deal:           <DollarSign size={14} />,
  contact:        <User size={14} />,
  account:        <Users size={14} />,
  product:        <Package size={14} />,
  warehouse:      <Package size={14} />,
  stock_movement: <Package size={14} />,
  user:           <User size={14} />,
  employee:       <Users size={14} />,
  settings:       <Settings size={14} />,
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `il y a ${d}j`
  if (h > 0) return `il y a ${h}h`
  if (m > 0) return `il y a ${m}min`
  return "à l'instant"
}

export default function ActivityClient({ users, lastLogins }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [needsMigration, setNeedsMigration] = useState(false)

  const [filterUser, setFilterUser]     = useState("")
  const [filterAction, setFilterAction] = useState("")
  const [filterResource, setFilterResource] = useState("")
  const [search, setSearch]             = useState("")

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (filterUser)     params.set("user_id", filterUser)
    if (filterAction)   params.set("action", filterAction)
    if (filterResource) params.set("resource", filterResource)

    const res = await fetch(`/api/logs?${params}`)
    const json = await res.json()
    setLogs(json.logs ?? [])
    setTotal(json.total ?? 0)
    setNeedsMigration(json.needsMigration ?? false)
    setLoading(false)
  }, [filterUser, filterAction, filterResource])

  useEffect(() => { setPage(1); fetchLogs(1) }, [filterUser, filterAction, filterResource, fetchLogs])

  const filtered = search
    ? logs.filter(l =>
        l.label?.toLowerCase().includes(search.toLowerCase()) ||
        l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.user_email?.toLowerCase().includes(search.toLowerCase())
      )
    : logs

  // Users avec dernière connexion
  const usersWithLogin = users.map(u => ({
    ...u,
    lastLogin: lastLogins[u.id] ?? null,
  })).sort((a, b) => {
    if (!a.lastLogin) return 1
    if (!b.lastLogin) return -1
    return new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()
  })

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Journal d'activité</h1>
            <p className="text-sm text-gray-500">Suivi des actions et connexions des utilisateurs</p>
          </div>
        </div>
        <button onClick={() => fetchLogs(page)} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>

      {/* Migration banner */}
      {needsMigration && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>⚠️ Table non créée.</strong> Exécute ce SQL dans le SQL Editor de Supabase pour activer les logs :
          <pre className="mt-2 text-xs bg-amber-100 rounded p-2 overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS geg_guinee.activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text, user_name text,
  action text NOT NULL, resource text NOT NULL,
  resource_id text, label text, details jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE geg_guinee.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read logs" ON geg_guinee.activity_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));`}</pre>
        </div>
      )}

      {/* Dernières connexions */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <LogIn size={15} className="text-blue-600" />
          <h2 className="font-semibold text-sm text-gray-800">Dernières connexions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Utilisateur</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Dernière connexion</th>
                <th className="text-left px-4 py-2">Il y a</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {usersWithLogin.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs">
                        {(u.full_name ?? u.email ?? "?")[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{u.full_name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{u.email}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {u.lastLogin ? formatDate(u.lastLogin) : <span className="text-gray-400">Jamais connecté</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.lastLogin
                      ? <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{timeAgo(u.lastLogin)}</span>
                      : <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtres</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tous les utilisateurs</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>)}
          </select>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Toutes les actions</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterResource} onChange={e => setFilterResource(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Toutes les sections</option>
            <option value="invoice">Factures</option>
            <option value="devis">Devis</option>
            <option value="achat">Achats</option>
            <option value="payment">Paiements</option>
            <option value="deal">Opportunités</option>
            <option value="contact">Contacts</option>
            <option value="account">Comptes</option>
            <option value="product">Produits</option>
            <option value="user">Utilisateurs</option>
          </select>
        </div>
      </div>

      {/* Journal */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-gray-500" />
            <h2 className="font-semibold text-sm text-gray-800">Journal des actions</h2>
          </div>
          <span className="text-xs text-gray-400">{total} entrée{total !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
            <RefreshCw size={14} className="animate-spin" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Aucune activité trouvée</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Date & Heure</th>
                  <th className="text-left px-4 py-2">Utilisateur</th>
                  <th className="text-left px-4 py-2">Action</th>
                  <th className="text-left px-4 py-2">Section</th>
                  <th className="text-left px-4 py-2">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(log => {
                  const act = ACTION_LABELS[log.action] ?? { label: log.action, color: "text-gray-600", bg: "bg-gray-50 border-gray-200" }
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="text-gray-700 font-medium">{formatDate(log.created_at)}</div>
                        <div className="text-xs text-gray-400">{timeAgo(log.created_at)}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs flex-shrink-0">
                            {(log.user_name ?? log.user_email ?? "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800 truncate max-w-[120px]">{log.user_name ?? "—"}</div>
                            <div className="text-xs text-gray-400 truncate max-w-[120px]">{log.user_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${act.bg} ${act.color}`}>
                          {act.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          {RESOURCE_ICONS[log.resource] ?? <Activity size={14} />}
                          <span className="capitalize text-xs">{log.resource}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 max-w-xs">
                        <span className="truncate block">{log.label}</span>
                        {log.resource_id && (
                          <span className="text-xs text-gray-400 font-mono">#{log.resource_id.slice(0, 8)}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 50 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">Page {page} · {Math.ceil(total / 50)} pages</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetchLogs(page - 1) }}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                ← Précédent
              </button>
              <button disabled={page >= Math.ceil(total / 50)} onClick={() => { setPage(p => p + 1); fetchLogs(page + 1) }}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Suivant →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
