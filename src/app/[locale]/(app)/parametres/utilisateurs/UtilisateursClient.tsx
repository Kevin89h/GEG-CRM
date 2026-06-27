"use client"

import { useState } from "react"
import { Users, Plus, X, Shield, ChevronDown, ChevronUp, Check, Mail, Loader2, Trash2, RefreshCw, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/Badge"

interface Permission {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
}

type Permissions = Record<string, Permission>

interface UserProfile {
  id: string
  full_name: string | null
  email: string
  role: string
  permissions: Permissions
}

interface Props {
  users: UserProfile[]
}

const MODULES = [
  { key: "dashboard",    label: "Tableau de bord" },
  { key: "accounts",     label: "Comptes/Clients" },
  { key: "contacts",     label: "Contacts" },
  { key: "deals",        label: "Opportunités" },
  { key: "activities",   label: "Activités" },
  { key: "ventes",       label: "Ventes" },
  { key: "achats",       label: "Achats" },
  { key: "stock",        label: "Stock" },
  { key: "comptabilite", label: "Trésorerie" },
  { key: "employes",     label: "Employés" },
  { key: "documents",    label: "Documents" },
  { key: "parametres",   label: "Paramètres" },
] as const

const ACTIONS = ["view", "create", "edit", "delete"] as const
const ACTION_LABELS: Record<string, string> = {
  view: "Voir", create: "Créer", edit: "Modifier", delete: "Supprimer"
}

const DEFAULT_PERMISSIONS: Permissions = {
  dashboard:    { view: true,  create: false, edit: false, delete: false },
  accounts:     { view: true,  create: true,  edit: true,  delete: false },
  contacts:     { view: true,  create: true,  edit: true,  delete: false },
  deals:        { view: true,  create: true,  edit: true,  delete: false },
  activities:   { view: true,  create: true,  edit: true,  delete: false },
  ventes:       { view: true,  create: true,  edit: true,  delete: false },
  achats:       { view: true,  create: true,  edit: true,  delete: false },
  stock:        { view: true,  create: true,  edit: true,  delete: false },
  comptabilite: { view: true,  create: false, edit: false, delete: false },
  employes:     { view: true,  create: false, edit: false, delete: false },
  documents:    { view: true,  create: true,  edit: true,  delete: false },
  parametres:   { view: false, create: false, edit: false, delete: false },
}

const ADMIN_PERMISSIONS: Permissions = Object.fromEntries(
  MODULES.map(m => [m.key, { view: true, create: true, edit: true, delete: true }])
)

const roleColor: Record<string, "blue" | "green" | "yellow" | "gray"> = {
  admin: "blue", manager: "green", sales: "yellow", user: "gray",
}
const roleLabel: Record<string, string> = {
  admin: "Admin", manager: "Manager", sales: "Commercial", user: "Utilisateur",
}

export default function UtilisateursClient({ users: initial }: Props) {
  const [users, setUsers] = useState(initial)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("user")
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function togglePerm(userId: string, module: string, action: string) {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u
      const perms = { ...u.permissions }
      const mod = { ...(perms[module] ?? { view: false, create: false, edit: false, delete: false }) }
      const newVal = !mod[action as keyof Permission]
      // "view" must be true if any other action is true
      if (action !== "view" && newVal) mod.view = true
      // if removing view, remove all
      if (action === "view" && !newVal) {
        mod.create = false; mod.edit = false; mod.delete = false
      }
      mod[action as keyof Permission] = newVal
      perms[module] = mod
      return { ...u, permissions: perms }
    }))
  }

  async function savePermissions(user: UserProfile) {
    setSaving(user.id)
    try {
      const res = await fetch("/api/users/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: user.role, permissions: user.permissions }),
      })
      if (!res.ok) throw new Error(await res.text())
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(userId: string) {
    setDeleting(true)
    const res = await fetch("/api/users/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== userId))
      setConfirmDeleteId(null)
    }
    setDeleting(false)
  }

  async function handleResendInvite(user: UserProfile) {
    setResendingId(user.id)
    setResendSuccess(null)
    const res = await fetch("/api/users/resend-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, role: user.role }),
    })
    if (res.ok) setResendSuccess(user.id)
    setResendingId(null)
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError("")
    setInviteSuccess("")
    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Erreur")
      setInviteSuccess(`Invitation envoyée à ${inviteEmail}`)
      setInviteEmail("")
      // Add placeholder user
      if (body.user) {
        setUsers(prev => [...prev, {
          id: body.user.id,
          email: body.user.email,
          full_name: null,
          role: inviteRole,
          permissions: inviteRole === "admin" ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS,
        }])
      }
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900 text-lg">Inviter un utilisateur</h3>
              <button onClick={() => { setShowInvite(false); setInviteSuccess(""); setInviteError("") }}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Adresse email *</label>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} type="email"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@exemple.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="user">Utilisateur</option>
                  <option value="sales">Commercial</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {inviteError && <p className="text-xs text-red-600 mt-3">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-emerald-600 mt-3 flex items-center gap-1"><Check className="w-3 h-3" />{inviteSuccess}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowInvite(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
                Fermer
              </button>
              <button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-40 flex items-center justify-center gap-2">
                {inviting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</> : <><Mail className="w-4 h-4" /> Inviter</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Utilisateurs & Permissions</h2>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} utilisateur{users.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition shadow-sm">
          <Plus className="w-4 h-4" />
          Inviter
        </button>
      </div>

      {/* Confirm delete modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Supprimer cet utilisateur ?</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {users.find(u => u.id === confirmDeleteId)?.email}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3 mb-5">
              L'utilisateur perdra immédiatement l'accès au CRM. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
                Annuler
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition disabled:opacity-50">
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="space-y-3">
        {users.map(user => (
          <div key={user.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* User row */}
            <div className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 font-semibold text-sm">
                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{user.full_name || "—"}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              <Badge variant={roleColor[user.role] ?? "gray"}>{roleLabel[user.role] ?? user.role}</Badge>
              <button onClick={() => toggleExpand(user.id)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition px-2 py-1.5 rounded-lg hover:bg-blue-50">
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Permissions</span>
                {expandedId === user.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => handleResendInvite(user)}
                disabled={resendingId === user.id}
                title="Renvoyer l'invitation"
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-40"
              >
                {resendingId === user.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : resendSuccess === user.id
                  ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setConfirmDeleteId(user.id)}
                title="Supprimer l'utilisateur"
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Permissions table */}
            {expandedId === user.id && (
              <div className="border-t border-gray-100 px-4 pb-4">
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left py-2 pr-4 font-medium w-40">Module</th>
                        {ACTIONS.map(a => (
                          <th key={a} className="text-center py-2 px-3 font-medium w-20">{ACTION_LABELS[a]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {MODULES.map(({ key, label }) => {
                        const perm = user.permissions[key] ?? { view: false, create: false, edit: false, delete: false }
                        return (
                          <tr key={key} className="hover:bg-gray-50">
                            <td className="py-2 pr-4 font-medium text-gray-700">{label}</td>
                            {ACTIONS.map(action => (
                              <td key={action} className="py-2 px-3 text-center">
                                <button
                                  onClick={() => togglePerm(user.id, key, action)}
                                  className={`w-5 h-5 rounded flex items-center justify-center mx-auto transition ${
                                    perm[action]
                                      ? "bg-blue-600 text-white"
                                      : "bg-gray-100 text-gray-300 hover:bg-gray-200"
                                  }`}
                                >
                                  {perm[action] && <Check className="w-3 h-3" />}
                                </button>
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-3">
                  <button onClick={() => savePermissions(user)} disabled={saving === user.id}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                    {saving === user.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enregistrement...</> : <><Check className="w-3.5 h-3.5" /> Sauvegarder</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
