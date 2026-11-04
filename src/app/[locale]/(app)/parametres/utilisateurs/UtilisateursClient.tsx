"use client"

import { useEffect, useState } from "react"
import { Plus, X, Shield, ChevronDown, ChevronUp, Check, Mail, Loader2, Ban, RefreshCw, AlertTriangle, UserPlus, Eye, EyeOff, Lock, Unlock } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { ROLES, roleLabel } from "@/lib/roles"
import { ROLE_DESCRIPTIONS } from "@/lib/permissions"

interface UserProfile {
  id: string
  full_name: string | null
  email: string
  role: string
  company_access: string[]
  /** Blocked account: keeps its history, can no longer sign in or act */
  is_blocked: boolean
  /** Whether the current user may edit or delete this account (computed on the server) */
  manageable: boolean
}

interface Company {
  id: string
  name: string
}

/** Access request opened from a notification (see /api/access-request) */
export interface AccessRequest {
  userId: string
  name: string
  role: string
  module: string
  /** "role": a business module, granted by a role change; "company": needs a company (GEG Singapore) */
  kind: "role" | "company"
  granted: boolean
}

interface Props {
  users: UserProfile[]
  companies: Company[]
  currentUserId: string
  assignableRoles: string[]
  canAssignCompanies: boolean
  accessRequest: AccessRequest | null
}

const roleColor: Record<string, "blue" | "green" | "yellow" | "gray"> = {
  super_admin: "blue", admin: "blue", manager: "green", sales_rep: "yellow",
}

export default function UtilisateursClient({ users: initial, companies, currentUserId, assignableRoles, canAssignCompanies, accessRequest }: Props) {
  const roleOptions = ROLES.filter(r => assignableRoles.includes(r.value))
  const requester = accessRequest ? initial.find(u => u.id === accessRequest.userId) : undefined
  const [users, setUsers] = useState(initial)
  const [expandedId, setExpandedId] = useState<string | null>(
    accessRequest && !accessRequest.granted && requester?.manageable ? accessRequest.userId : null
  )

  // Bring the requester's card into view when arriving from an access-request notification
  useEffect(() => {
    if (accessRequest) document.getElementById(`user-${accessRequest.userId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [accessRequest])
  const [saving, setSaving] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<{ id: string; message: string } | null>(null)
  const [newCompanyIds, setNewCompanyIds] = useState<string[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [modalTab, setModalTab] = useState<"invite" | "create">("invite")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("sales_rep")
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState("")
  // Create user form
  const [createUsername, setCreateUsername] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createName, setCreateName] = useState("")
  const [createPhone, setCreatePhone] = useState("")
  const [createJobTitle, setCreateJobTitle] = useState("")
  const [createRole, setCreateRole] = useState("sales_rep")
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [createSuccess, setCreateSuccess] = useState("")
  const [confirmBlockId, setConfirmBlockId] = useState<string | null>(null)
  const [blocking, setBlocking] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function setUserField(userId: string, field: "role" | "company_access", value: string | string[]) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: value } : u))
  }

  function toggleCompany(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
  }

  async function savePermissions(user: UserProfile) {
    setSaving(user.id)
    setSaveError(null)
    try {
      const res = await fetch("/api/users/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          role: user.role,
          ...(canAssignCompanies ? { company_ids: user.company_access } : {}),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSaveError({ id: user.id, message: body.error ?? "Erreur lors de l'enregistrement" })
      }
    } finally {
      setSaving(null)
    }
  }

  async function handleBlock(userId: string, blocked: boolean) {
    setBlocking(true)
    setSaveError(null)
    const res = await fetch("/api/users/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, blocked }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: blocked } : u))
    } else {
      const body = await res.json().catch(() => ({}))
      setSaveError({ id: userId, message: body.error ?? "Erreur" })
    }
    setConfirmBlockId(null)
    setBlocking(false)
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
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          ...(canAssignCompanies && newCompanyIds.length ? { company_ids: newCompanyIds } : {}),
        }),
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
          is_blocked: false,
          company_access: newCompanyIds,
          manageable: true,
        }])
      }
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setInviting(false)
    }
  }

  function resetModal() {
    setInviteEmail(""); setInviteRole("sales_rep"); setInviteError(""); setInviteSuccess("")
    setCreateUsername(""); setCreatePassword(""); setCreateName(""); setCreatePhone("")
    setCreateJobTitle(""); setCreateRole("sales_rep"); setCreateError(""); setCreateSuccess("")
    setShowPassword(false); setNewCompanyIds([])
  }

  async function handleCreate() {
    if (!createUsername.trim() || !createPassword) return
    setCreating(true); setCreateError(""); setCreateSuccess("")
    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: createUsername.trim(),
          password: createPassword,
          full_name: createName.trim() || null,
          phone: createPhone.trim() || null,
          job_title: createJobTitle.trim() || null,
          role: createRole,
          ...(canAssignCompanies && newCompanyIds.length ? { company_ids: newCompanyIds } : {}),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Erreur")
      setCreateSuccess(`Compte créé pour @${createUsername.trim()}`)
      if (body.user) {
        setUsers(prev => [...prev, {
          id: body.user.id,
          email: body.user.email,
          full_name: createName.trim() || createUsername.trim(),
          role: createRole,
          is_blocked: false,
          company_access: newCompanyIds,
          manageable: true,
        }])
      }
      setCreateUsername(""); setCreatePassword(""); setCreateName("")
      setCreatePhone(""); setCreateJobTitle("")
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setCreating(false)
    }
  }

  function companyPicker(selected: string[], onToggle: (id: string) => void) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Sociétés</label>
        <div className="flex flex-wrap gap-3">
          {companies.map(c => (
            <label key={c.id} className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" checked={selected.includes(c.id)} onChange={() => onToggle(c.id)} />
              {c.name}
            </label>
          ))}
        </div>
        {selected.length === 0 && <p className="text-xs text-gray-400 mt-1">Aucune cochée : GEG Guinée par défaut.</p>}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Invite / Create modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">Ajouter un utilisateur</h3>
              <button onClick={() => { setShowInvite(false); resetModal() }}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
              <button onClick={() => { setModalTab("invite"); setCreateError(""); setCreateSuccess("") }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition ${modalTab === "invite" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                <Mail className="w-4 h-4" /> Inviter par email
              </button>
              <button onClick={() => { setModalTab("create"); setInviteError(""); setInviteSuccess("") }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition ${modalTab === "create" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                <UserPlus className="w-4 h-4" /> Créer le compte
              </button>
            </div>

            {/* ── Tab: Inviter ── */}
            {modalTab === "invite" && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  Un email d'invitation sera envoyé. L'utilisateur crée lui-même son mot de passe.
                </p>
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
                    {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {canAssignCompanies && companyPicker(newCompanyIds, id => setNewCompanyIds(prev => toggleCompany(prev, id)))}
                {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
                {inviteSuccess && <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" />{inviteSuccess}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowInvite(false); resetModal() }}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
                    Fermer
                  </button>
                  <button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-40 flex items-center justify-center gap-2">
                    {inviting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</> : <><Mail className="w-4 h-4" /> Inviter</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── Tab: Créer ── */}
            {modalTab === "create" && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Le compte est créé immédiatement. Communiquez le mot de passe à l'utilisateur.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pseudo (identifiant) *</label>
                    <input value={createUsername} onChange={e => setCreateUsername(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ex: jean.dupont" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom complet</label>
                    <input value={createName} onChange={e => setCreateName(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Prénom Nom" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe * (min. 8 caractères)</label>
                  <div className="relative">
                    <input value={createPassword} onChange={e => setCreatePassword(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
                    <input value={createPhone} onChange={e => setCreatePhone(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+224 6xx xxx xxx" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Poste / Fonction</label>
                    <input value={createJobTitle} onChange={e => setCreateJobTitle(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Comptable" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
                  <select value={createRole} onChange={e => setCreateRole(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {canAssignCompanies && companyPicker(newCompanyIds, id => setNewCompanyIds(prev => toggleCompany(prev, id)))}
                {createError && <p className="text-xs text-red-600">{createError}</p>}
                {createSuccess && <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" />{createSuccess}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowInvite(false); resetModal() }}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
                    Fermer
                  </button>
                  <button onClick={handleCreate}
                    disabled={!createUsername.trim() || createPassword.length < 8 || creating}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 transition disabled:opacity-40 flex items-center justify-center gap-2">
                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Création…</> : <><UserPlus className="w-4 h-4" /> Créer le compte</>}
                  </button>
                </div>
              </div>
            )}
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

      {/* Access request coming from a notification */}
      {accessRequest && (
        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${accessRequest.granted ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
          {accessRequest.granted ? (
            <p className="flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span><strong>{accessRequest.name}</strong> a déjà accès à « {accessRequest.module} ».</span>
            </p>
          ) : (
            <>
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span><strong>{accessRequest.name}</strong> ({accessRequest.role}) demande l&apos;accès à « {accessRequest.module} ».</span>
              </p>
              <p className="mt-1.5 pl-6">
                {accessRequest.kind === "company" ? (
                  canAssignCompanies
                    ? <>Pour lui donner accès, cochez <strong>GEG Singapore</strong> dans sa fiche ci-dessous, puis cliquez sur <strong>Sauvegarder</strong>.</>
                    : <>Seul un <strong>super admin</strong> peut lui attribuer la société GEG Singapore.</>
                ) : requester && !requester.manageable ? (
                  <>Vous ne pouvez pas modifier ce compte : demandez à un <strong>super admin</strong>.</>
                ) : (
                  <>Pour lui donner accès, changez son rôle en <strong>Manager</strong> dans sa fiche ci-dessous, puis cliquez sur <strong>Sauvegarder</strong>.</>
                )}
              </p>
            </>
          )}
        </div>
      )}

      {/* Confirm block modal */}
      {confirmBlockId && (() => {
        const target = users.find(u => u.id === confirmBlockId)
        const unblock = !!target?.is_blocked
        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${unblock ? "bg-emerald-100" : "bg-red-100"}`}>
                  {unblock ? <Unlock className="w-5 h-5 text-emerald-600" /> : <Ban className="w-5 h-5 text-red-600" />}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{unblock ? "Réactiver ce compte ?" : "Bloquer ce compte ?"}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{target?.email}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3 mb-5">
                {unblock
                  ? "La personne pourra de nouveau se connecter, avec son rôle et ses sociétés."
                  : "La personne est déconnectée tout de suite et ne peut plus se connecter. Son compte et tout son historique sont conservés ; vous pourrez le réactiver."}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmBlockId(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
                  Annuler
                </button>
                <button onClick={() => handleBlock(confirmBlockId, !unblock)} disabled={blocking}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition disabled:opacity-50 ${unblock ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                  {blocking ? "…" : unblock ? "Réactiver" : "Bloquer"}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* User list */}
      <div className="space-y-3">
        {users.map(user => (
          <div key={user.id} id={`user-${user.id}`}
            className={`bg-white rounded-xl border shadow-sm overflow-hidden ${accessRequest?.userId === user.id ? "border-amber-300 ring-2 ring-amber-200" : "border-gray-100"}`}>
            {/* User row */}
            <div className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 font-semibold text-sm">
                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{user.full_name || "—"}</p>
                <p className="text-xs text-gray-400">
                  {user.email.endsWith("@geg.internal")
                    ? `@${user.email.replace("@geg.internal", "")}`
                    : user.email}
                </p>
                <p className="text-xs text-gray-400">
                  {companies.filter(c => user.company_access.includes(c.id)).map(c => c.name).join(" + ") || "Aucune société"}
                </p>
              </div>
              {user.is_blocked && <Badge variant="red">Bloqué</Badge>}
              <Badge variant={roleColor[user.role] ?? "gray"}>{roleLabel(user.role)}</Badge>
              {!user.manageable ? (
                <span title="Vous ne pouvez pas gérer ce compte" className="flex items-center gap-1.5 text-xs text-gray-400 px-2 py-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Protégé</span>
                </span>
              ) : (
              <>
              <button onClick={() => toggleExpand(user.id)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition px-2 py-1.5 rounded-lg hover:bg-blue-50">
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Rôle</span>
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
              {user.id !== currentUserId && (
                <button
                  onClick={() => setConfirmBlockId(user.id)}
                  title={user.is_blocked ? "Réactiver le compte" : "Bloquer le compte"}
                  className={`p-1.5 rounded-lg transition ${user.is_blocked ? "text-red-500 hover:text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}
                >
                  {user.is_blocked ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                </button>
              )}
              </>
              )}
            </div>

            {saveError?.id === user.id && expandedId !== user.id && <p className="px-4 pb-3 text-xs text-red-600">{saveError.message}</p>}
            {/* Role and companies (rights come from the role, see src/lib/permissions.ts) */}
            {expandedId === user.id && user.manageable && (
              <div className="border-t border-gray-100 px-4 pb-4">
                <div className="flex flex-wrap items-start gap-6 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
                    <select
                      value={user.role}
                      disabled={user.id === currentUserId}
                      title={user.id === currentUserId ? "Vous ne pouvez pas changer votre propre rôle" : undefined}
                      onChange={e => setUserField(user.id, "role", e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      {!roleOptions.some(r => r.value === user.role) && <option value={user.role}>{roleLabel(user.role)}</option>}
                      {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  {canAssignCompanies && companyPicker(user.company_access, id => setUserField(user.id, "company_access", toggleCompany(user.company_access, id)))}
                </div>
                <p className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <strong>{roleLabel(user.role)} :</strong> {ROLE_DESCRIPTIONS[user.role] ?? "—"}
                </p>
                <div className="flex items-center justify-end gap-3 mt-3">
                  {saveError?.id === user.id && <p className="text-xs text-red-600">{saveError.message}</p>}
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
