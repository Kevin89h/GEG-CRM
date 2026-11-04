"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, X, Shield, ChevronDown, ChevronUp, Check, Mail, Loader2, RefreshCw, AlertTriangle, UserPlus, Eye, EyeOff, Lock, Ban, Unlock, History, RotateCcw, Minus } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { ROLES, roleLabel } from "@/lib/roles"

interface UserProfile {
  id: string
  full_name: string | null
  email: string
  role: string
  company_access: string[]
  is_blocked: boolean
  /** Whether the current user may manage this account (computed on the server, decision Q3) */
  manageable: boolean
}

interface Company { id: string; name: string; schema_name: string }

export interface CatalogEntry {
  key: string; module: string; label: string; sort: number
  sensitive: boolean; customizable: boolean; grantable_to_sales_rep: boolean
}

export interface Override {
  id: string; user_id: string; company_id: string; permission_key: string; effect: "grant" | "deny"; reason: string | null; created_at: string
}

/** Access request opened from a notification (see /api/access-request) */
export interface AccessRequest {
  userId: string
  name: string
  role: string
  module: string
  companyId: string | null
  companyName: string | null
  permission: string | null
  permissionLabel: string | null
  /** "company": the company isn't assigned; "permission": add the permission in that company; "role": change the role */
  kind: "company" | "permission" | "role"
}

interface HistoryEvent {
  id: number; occurred_at: string; actor: string; company: string | null; action: string
  old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null
}

interface Props {
  users: UserProfile[]
  companies: Company[]
  catalog: CatalogEntry[]
  roleStandards: Record<string, string[]>
  overrides: Override[]
  currentUserId: string
  actorCompanyIds: string[]
  isSuperAdmin: boolean
  assignableRoles: string[]
  accessRequest: AccessRequest | null
}

const roleColor: Record<string, "blue" | "green" | "yellow" | "gray"> = {
  super_admin: "blue", admin: "blue", manager: "green", sales_rep: "yellow",
}

const ACTION_LABELS: Record<string, string> = {
  "compte.creation": "Compte créé", "compte.role": "Rôle modifié", "compte.societes": "Sociétés modifiées",
  "compte.blocage": "Compte bloqué", "compte.reactivation": "Compte réactivé", "compte.grille": "Ancienne grille modifiée",
  "permission.grant": "Ajout personnel", "permission.deny": "Retrait personnel", "permission.retour_standard": "Retour au standard du rôle",
}

type CellState = "standard" | "granted" | "denied" | "off" | "reserved" | "forbidden"

export default function UtilisateursClient({
  users: initial, companies, catalog, roleStandards, overrides: initialOverrides, currentUserId,
  actorCompanyIds, isSuperAdmin, assignableRoles, accessRequest,
}: Props) {
  const roleOptions = ROLES.filter(r => assignableRoles.includes(r.value))
  const requester = accessRequest ? initial.find(u => u.id === accessRequest.userId) : undefined
  const [users, setUsers] = useState(initial)
  const [overrides, setOverrides] = useState(initialOverrides)
  const [expandedId, setExpandedId] = useState<string | null>(requester?.manageable ? accessRequest!.userId : null)
  const [companyTab, setCompanyTab] = useState<Record<string, string>>(
    accessRequest?.companyId ? { [accessRequest.userId]: accessRequest.companyId } : {}
  )
  const [draftRole, setDraftRole] = useState<Record<string, string>>({})
  const [draftCompanies, setDraftCompanies] = useState<Record<string, string[]>>({})
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ id: string; message: string } | null>(null)
  const [roleChange, setRoleChange] = useState<{ user: UserProfile; role: string; drop: Set<string> } | null>(null)
  const [resetFor, setResetFor] = useState<{ user: UserProfile; companyId: string } | null>(null)
  const [confirmBlock, setConfirmBlock] = useState<UserProfile | null>(null)
  const [history, setHistory] = useState<{ user: UserProfile; events: HistoryEvent[] | null } | null>(null)

  // Invite / create modal
  const [newCompanyIds, setNewCompanyIds] = useState<string[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [modalTab, setModalTab] = useState<"invite" | "create">("invite")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("sales_rep")
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState("")
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
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (accessRequest) document.getElementById(`user-${accessRequest.userId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [accessRequest])

  const modules = useMemo(() => {
    const groups: { module: string; entries: CatalogEntry[] }[] = []
    for (const c of catalog) {
      const g = groups.find(x => x.module === c.module)
      if (g) g.entries.push(c); else groups.push({ module: c.module, entries: [c] })
    }
    return groups
  }, [catalog])

  const companyName = (id: string) => companies.find(c => c.id === id)?.name ?? "Société retirée"
  /** Companies of the account the actor may edit exceptions for */
  const editableCompanies = (u: UserProfile) => u.company_access.filter(id => isSuperAdmin || actorCompanyIds.includes(id))

  function cellState(u: UserProfile, companyId: string, c: CatalogEntry): CellState {
    const std = (roleStandards[u.role] ?? []).includes(c.key)
    if (!c.customizable) return std ? "reserved" : "forbidden"
    const o = overrides.find(x => x.user_id === u.id && x.company_id === companyId && x.permission_key === c.key)
    if (o?.effect === "deny") return "denied"
    if (o?.effect === "grant") return "granted"
    if (std) return "standard"
    if (u.role === "sales_rep" && !c.grantable_to_sales_rep) return "forbidden"
    return "off"
  }

  function summary(u: UserProfile, companyId: string): string {
    const own = overrides.filter(o => o.user_id === u.id && o.company_id === companyId)
    const g = own.filter(o => o.effect === "grant").length, d = own.filter(o => o.effect === "deny").length
    const parts = [`standard ${roleLabel(u.role)}`]
    if (g) parts.push(`${g} ajout${g > 1 ? "s" : ""}`)
    if (d) parts.push(`${d} retrait${d > 1 ? "s" : ""}`)
    return parts.join(" · ")
  }

  async function api(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error ?? "Erreur")
    return json
  }

  async function toggle(u: UserProfile, companyId: string, c: CatalogEntry) {
    const state = cellState(u, companyId, c)
    if (state === "reserved" || state === "forbidden") return
    const effect = state === "standard" ? "deny" : state === "off" ? "grant" : "inherit"
    setBusy(`${u.id}:${c.key}`); setError(null)
    try {
      const json = await api("/api/users/overrides", "POST", { userId: u.id, companyId, permission: c.key, effect, reason })
      setOverrides(prev => {
        const rest = prev.filter(o => !(o.user_id === u.id && o.company_id === companyId && o.permission_key === c.key))
        return json.effect === "inherit" ? rest : [...rest, {
          id: crypto.randomUUID(), user_id: u.id, company_id: companyId, permission_key: c.key,
          effect: json.effect, reason: reason || null, created_at: new Date().toISOString(),
        }]
      })
    } catch (e) {
      setError({ id: u.id, message: e instanceof Error ? e.message : "Erreur" })
    } finally {
      setBusy(null)
    }
  }

  async function doReset() {
    if (!resetFor) return
    const { user, companyId } = resetFor
    setBusy(user.id); setError(null)
    try {
      await api("/api/users/overrides", "POST", { userId: user.id, companyId, reset: true })
      setOverrides(prev => prev.filter(o => !(o.user_id === user.id && o.company_id === companyId)))
      setResetFor(null)
    } catch (e) {
      setError({ id: user.id, message: e instanceof Error ? e.message : "Erreur" })
    } finally {
      setBusy(null)
    }
  }

  /** Saves role and companies; a role change with exceptions first asks what to do with them (never silent) */
  function saveRoleAndCompanies(u: UserProfile) {
    const role = draftRole[u.id] ?? u.role
    const own = overrides.filter(o => o.user_id === u.id)
    if (role !== u.role && own.length) {
      // Proposed by default: remove the exceptions that become pointless with the new role
      const std = roleStandards[role] ?? []
      const drop = new Set(own.filter(o => (o.effect === "grant" && std.includes(o.permission_key)) || (o.effect === "deny" && !std.includes(o.permission_key))).map(o => o.id))
      setRoleChange({ user: u, role, drop })
      return
    }
    void commitRoleAndCompanies(u, role, [])
  }

  async function commitRoleAndCompanies(u: UserProfile, role: string, drop: string[]) {
    setBusy(u.id); setError(null)
    try {
      const companiesDraft = draftCompanies[u.id]
      await api("/api/users/permissions", "PATCH", {
        userId: u.id,
        ...(role !== u.role ? { role } : {}),
        ...(isSuperAdmin && companiesDraft ? { company_ids: companiesDraft } : {}),
        ...(drop.length ? { dropOverrides: drop } : {}),
      })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role, company_access: companiesDraft ?? x.company_access } : x))
      setOverrides(prev => prev.filter(o => !drop.includes(o.id)))
      setDraftRole(prev => { const n = { ...prev }; delete n[u.id]; return n })
      setDraftCompanies(prev => { const n = { ...prev }; delete n[u.id]; return n })
      setRoleChange(null)
    } catch (e) {
      setError({ id: u.id, message: e instanceof Error ? e.message : "Erreur" })
    } finally {
      setBusy(null)
    }
  }

  async function doBlock() {
    if (!confirmBlock) return
    const u = confirmBlock, blocked = !u.is_blocked
    setBusy(u.id); setError(null)
    try {
      await api("/api/users/block", "POST", { userId: u.id, blocked })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_blocked: blocked } : x))
    } catch (e) {
      setError({ id: u.id, message: e instanceof Error ? e.message : "Erreur" })
    } finally {
      setBusy(null); setConfirmBlock(null)
    }
  }

  async function openHistory(u: UserProfile) {
    setHistory({ user: u, events: null })
    const res = await fetch(`/api/users/history?userId=${u.id}`)
    const json = await res.json().catch(() => ({}))
    setHistory({ user: u, events: json.events ?? [] })
  }

  async function handleResendInvite(user: UserProfile) {
    setResendingId(user.id); setResendSuccess(null)
    const res = await fetch("/api/users/resend-invite", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, role: user.role }),
    })
    if (res.ok) setResendSuccess(user.id)
    setResendingId(null)
  }

  function toggleCompany(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteError(""); setInviteSuccess("")
    try {
      const body = await api("/api/users/invite", "POST", {
        email: inviteEmail.trim(), role: inviteRole,
        ...(isSuperAdmin && newCompanyIds.length ? { company_ids: newCompanyIds } : {}),
      })
      setInviteSuccess(`Invitation envoyée à ${inviteEmail}`)
      setInviteEmail("")
      if (body.user) setUsers(prev => [...prev, {
        id: body.user.id, email: body.user.email, full_name: null, role: inviteRole,
        company_access: newCompanyIds.length ? newCompanyIds : actorCompanyIds, is_blocked: false, manageable: true,
      }])
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setInviting(false)
    }
  }

  async function handleCreate() {
    if (!createUsername.trim() || !createPassword) return
    setCreating(true); setCreateError(""); setCreateSuccess("")
    try {
      const body = await api("/api/users/create", "POST", {
        username: createUsername.trim(), password: createPassword, full_name: createName.trim() || null,
        phone: createPhone.trim() || null, job_title: createJobTitle.trim() || null, role: createRole,
        ...(isSuperAdmin && newCompanyIds.length ? { company_ids: newCompanyIds } : {}),
      })
      setCreateSuccess(`Compte créé pour @${createUsername.trim()}`)
      if (body.user) setUsers(prev => [...prev, {
        id: body.user.id, email: body.user.email, full_name: createName.trim() || createUsername.trim(), role: createRole,
        company_access: newCompanyIds.length ? newCompanyIds : actorCompanyIds, is_blocked: false, manageable: true,
      }])
      setCreateUsername(""); setCreatePassword(""); setCreateName(""); setCreatePhone(""); setCreateJobTitle("")
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setCreating(false)
    }
  }

  function resetModal() {
    setInviteEmail(""); setInviteRole("sales_rep"); setInviteError(""); setInviteSuccess("")
    setCreateUsername(""); setCreatePassword(""); setCreateName(""); setCreatePhone("")
    setCreateJobTitle(""); setCreateRole("sales_rep"); setCreateError(""); setCreateSuccess("")
    setShowPassword(false); setNewCompanyIds([])
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
      </div>
    )
  }

  const input = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="max-w-5xl mx-auto">
      {/* Invite / Create modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">Ajouter un utilisateur</h3>
              <button onClick={() => { setShowInvite(false); resetModal() }}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
              <button onClick={() => setModalTab("invite")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition ${modalTab === "invite" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                <Mail className="w-4 h-4" /> Inviter par email
              </button>
              <button onClick={() => setModalTab("create")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition ${modalTab === "create" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                <UserPlus className="w-4 h-4" /> Créer le compte
              </button>
            </div>
            {modalTab === "invite" ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">Un email d&apos;invitation sera envoyé. L&apos;utilisateur crée lui-même son mot de passe.</p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Adresse email *</label>
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} type="email" className={input} placeholder="email@exemple.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className={input}>
                    {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {isSuperAdmin ? companyPicker(newCompanyIds, id => setNewCompanyIds(prev => toggleCompany(prev, id)))
                  : <p className="text-xs text-gray-500">Le compte aura vos sociétés.</p>}
                {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
                {inviteSuccess && <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" />{inviteSuccess}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowInvite(false); resetModal() }} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">Fermer</button>
                  <button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-40 flex items-center justify-center gap-2">
                    {inviting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</> : <><Mail className="w-4 h-4" /> Inviter</>}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">Le compte est créé immédiatement. Communiquez le mot de passe à l&apos;utilisateur.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pseudo (identifiant) *</label>
                    <input value={createUsername} onChange={e => setCreateUsername(e.target.value)} className={input} placeholder="ex: jean.dupont" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom complet</label>
                    <input value={createName} onChange={e => setCreateName(e.target.value)} className={input} placeholder="Prénom Nom" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe * (min. 8 caractères)</label>
                  <div className="relative">
                    <input value={createPassword} onChange={e => setCreatePassword(e.target.value)} type={showPassword ? "text" : "password"} className={`${input} pr-10`} placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
                    <input value={createPhone} onChange={e => setCreatePhone(e.target.value)} className={input} placeholder="+224 6xx xxx xxx" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Poste / Fonction</label>
                    <input value={createJobTitle} onChange={e => setCreateJobTitle(e.target.value)} className={input} placeholder="Ex: Comptable" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
                  <select value={createRole} onChange={e => setCreateRole(e.target.value)} className={input}>
                    {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {isSuperAdmin ? companyPicker(newCompanyIds, id => setNewCompanyIds(prev => toggleCompany(prev, id)))
                  : <p className="text-xs text-gray-500">Le compte aura vos sociétés.</p>}
                {createError && <p className="text-xs text-red-600">{createError}</p>}
                {createSuccess && <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" />{createSuccess}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowInvite(false); resetModal() }} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">Fermer</button>
                  <button onClick={handleCreate} disabled={!createUsername.trim() || createPassword.length < 8 || creating}
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
          <p className="text-sm text-gray-500 mt-0.5">{users.length} utilisateur{users.length !== 1 ? "s" : ""} · droits standards du rôle, ajouts et retraits personnels par société</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition shadow-sm">
          <Plus className="w-4 h-4" /> Inviter
        </button>
      </div>

      {/* Access request coming from a notification */}
      {accessRequest && (
        <div className="mb-5 rounded-xl border px-4 py-3 text-sm bg-amber-50 border-amber-200 text-amber-900">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span><strong>{accessRequest.name}</strong> ({accessRequest.role}) demande l&apos;accès à « {accessRequest.module} »{accessRequest.companyName ? <> pour <strong>{accessRequest.companyName}</strong></> : null}.</span>
          </p>
          <p className="mt-1.5 pl-6">
            {requester && !requester.manageable ? (
              <>Vous ne pouvez pas modifier ce compte : demandez à un <strong>super admin</strong>.</>
            ) : accessRequest.kind === "company" ? (
              isSuperAdmin
                ? <>Pour lui donner accès, cochez <strong>{accessRequest.companyName ?? "la société"}</strong> dans sa fiche ci-dessous, puis cliquez sur <strong>Enregistrer</strong>.</>
                : <>Seul un <strong>super admin</strong> peut lui attribuer cette société.</>
            ) : accessRequest.kind === "permission" ? (
              <>Pour lui donner accès, cliquez sur « <strong>{accessRequest.permissionLabel ?? accessRequest.permission}</strong> » dans l&apos;onglet <strong>{accessRequest.companyName}</strong> de sa fiche ci-dessous (ajout personnel), ou changez son rôle.</>
            ) : (
              <>Pour lui donner accès, changez son rôle dans sa fiche ci-dessous.</>
            )}
          </p>
        </div>
      )}

      {/* Role change: what happens to the existing exceptions */}
      {roleChange && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="font-semibold text-gray-900">Passer {roleChange.user.full_name || roleChange.user.email} en {roleLabel(roleChange.role)}</h3>
            <p className="text-sm text-gray-600 mt-2">Ce compte a des exceptions personnelles. Cochez celles à <strong>retirer</strong> ; les autres sont gardées. Celles devenues inutiles avec le nouveau rôle sont cochées d&apos;office.</p>
            <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {overrides.filter(o => o.user_id === roleChange.user.id).map(o => {
                const c = catalog.find(x => x.key === o.permission_key)
                return (
                  <label key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input type="checkbox" checked={roleChange.drop.has(o.id)} onChange={() => setRoleChange(rc => {
                      if (!rc) return rc
                      const drop = new Set(rc.drop); if (drop.has(o.id)) drop.delete(o.id); else drop.add(o.id)
                      return { ...rc, drop }
                    })} />
                    <span className={o.effect === "grant" ? "text-emerald-700" : "text-red-600"}>{o.effect === "grant" ? "+" : "−"}</span>
                    <span className="flex-1">{c?.label ?? o.permission_key}</span>
                    <span className="text-xs text-gray-400">{companyName(o.company_id)}</span>
                  </label>
                )
              })}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setRoleChange(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">Annuler</button>
              <button onClick={() => commitRoleAndCompanies(roleChange.user, roleChange.role, [...roleChange.drop])} disabled={busy === roleChange.user.id}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50">Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset confirmation */}
      {resetFor && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900">Réinitialiser aux droits du rôle ?</h3>
            <p className="text-sm text-gray-600 mt-2">{resetFor.user.full_name || resetFor.user.email} · <strong>{companyName(resetFor.companyId)}</strong>. Ces exceptions seront retirées (elles restent dans l&apos;historique) :</p>
            <ul className="mt-2 text-sm space-y-1">
              {overrides.filter(o => o.user_id === resetFor.user.id && o.company_id === resetFor.companyId).map(o => (
                <li key={o.id}><span className={o.effect === "grant" ? "text-emerald-700" : "text-red-600"}>{o.effect === "grant" ? "+ " : "− "}</span>{catalog.find(c => c.key === o.permission_key)?.label}</li>
              ))}
            </ul>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setResetFor(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">Annuler</button>
              <button onClick={doReset} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700">Réinitialiser</button>
            </div>
          </div>
        </div>
      )}

      {/* Block / reactivate confirmation */}
      {confirmBlock && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900">{confirmBlock.is_blocked ? "Réactiver ce compte ?" : "Bloquer ce compte ?"}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{confirmBlock.email}</p>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3 my-4">
              {confirmBlock.is_blocked
                ? "La personne pourra de nouveau se connecter, avec son rôle, ses sociétés et ses exceptions."
                : "La personne est déconnectée tout de suite et ne peut plus se connecter. Son compte et tout son historique sont conservés ; vous pourrez le réactiver."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmBlock(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">Annuler</button>
              <button onClick={doBlock} disabled={busy === confirmBlock.id}
                className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl disabled:opacity-50 ${confirmBlock.is_blocked ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                {confirmBlock.is_blocked ? "Réactiver" : "Bloquer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Historique des droits — {history.user.full_name || history.user.email}</h3>
              <button onClick={() => setHistory(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="overflow-y-auto divide-y divide-gray-100 text-sm">
              {history.events === null ? <p className="text-gray-400 py-4 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</p>
                : history.events.length === 0 ? <p className="text-gray-400 py-4">Aucun changement enregistré.</p>
                : history.events.map(e => (
                  <div key={e.id} className="py-2">
                    <p className="text-gray-900"><strong>{ACTION_LABELS[e.action] ?? e.action}</strong>{e.company ? ` · ${companies.find(c => c.schema_name === e.company)?.name ?? e.company}` : ""}</p>
                    <p className="text-xs text-gray-500">{new Date(e.occurred_at).toLocaleString("fr-FR")} · par {e.actor}</p>
                    <p className="text-xs text-gray-600 mt-0.5 break-all">
                      {e.old_values ? <>avant : {JSON.stringify(e.old_values)} · </> : null}{e.new_values ? <>après : {JSON.stringify(e.new_values)}</> : null}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="space-y-3">
        {users.map(user => {
          const expanded = expandedId === user.id && user.manageable
          const tabs = editableCompanies(user)
          const activeCompany = companyTab[user.id] && tabs.includes(companyTab[user.id]) ? companyTab[user.id] : tabs[0]
          const role = draftRole[user.id] ?? user.role
          const companiesDraft = draftCompanies[user.id] ?? user.company_access
          const dirty = role !== user.role || (draftCompanies[user.id] && draftCompanies[user.id].join() !== user.company_access.join())
          const inactive = overrides.filter(o => o.user_id === user.id && !user.company_access.includes(o.company_id))
          return (
            <div key={user.id} id={`user-${user.id}`}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden ${accessRequest?.userId === user.id ? "border-amber-300 ring-2 ring-amber-200" : "border-gray-100"}`}>
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-700 font-semibold text-sm">{(user.full_name || user.email).charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{user.full_name || "—"}</p>
                  <p className="text-xs text-gray-400">{user.email.endsWith("@geg.internal") ? `@${user.email.replace("@geg.internal", "")}` : user.email}</p>
                  <p className="text-xs text-gray-400">{user.company_access.map(companyName).join(" + ") || "Aucune société"}</p>
                </div>
                {user.is_blocked && <Badge variant="red">Bloqué</Badge>}
                <Badge variant={roleColor[user.role] ?? "gray"}>{roleLabel(user.role)}</Badge>
                {!user.manageable ? (
                  <span title="Vous ne pouvez pas gérer ce compte" className="flex items-center gap-1.5 text-xs text-gray-400 px-2 py-1.5">
                    <Lock className="w-3.5 h-3.5" /><span className="hidden sm:inline">Protégé</span>
                  </span>
                ) : (
                  <>
                    <button onClick={() => setExpandedId(prev => prev === user.id ? null : user.id)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition px-2 py-1.5 rounded-lg hover:bg-blue-50">
                      <Shield className="w-3.5 h-3.5" /><span className="hidden sm:inline">Droits</span>
                      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => openHistory(user)} title="Historique des droits" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                      <History className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleResendInvite(user)} disabled={resendingId === user.id} title="Renvoyer l'invitation"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40">
                      {resendingId === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : resendSuccess === user.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>
                    {user.id !== currentUserId && (
                      <button onClick={() => setConfirmBlock(user)} title={user.is_blocked ? "Réactiver le compte" : "Bloquer le compte"}
                        className={`p-1.5 rounded-lg transition ${user.is_blocked ? "text-red-500 hover:text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}>
                        {user.is_blocked ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </>
                )}
              </div>
              {error?.id === user.id && <p className="px-4 pb-3 text-xs text-red-600">{error.message}</p>}

              {expanded && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  {/* Role and companies */}
                  <div className="flex flex-wrap items-end gap-6 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
                      <select value={role} onChange={e => setDraftRole(prev => ({ ...prev, [user.id]: e.target.value }))}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {!roleOptions.some(r => r.value === user.role) && <option value={user.role}>{roleLabel(user.role)}</option>}
                        {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    {isSuperAdmin && companyPicker(companiesDraft, id => setDraftCompanies(prev => ({ ...prev, [user.id]: toggleCompany(companiesDraft, id) })))}
                    {dirty && (
                      <button onClick={() => saveRoleAndCompanies(user)} disabled={busy === user.id}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50">
                        <Check className="w-3.5 h-3.5" /> Enregistrer
                      </button>
                    )}
                  </div>
                  {inactive.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">{inactive.length} exception(s) conservée(s) pour une société non attribuée (inactives).</p>
                  )}

                  {/* Company tabs */}
                  {tabs.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500">Aucune société de ce compte dans votre périmètre.</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 mt-4 border-b border-gray-100">
                        {tabs.map(id => (
                          <button key={id} onClick={() => setCompanyTab(prev => ({ ...prev, [user.id]: id }))}
                            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${id === activeCompany ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                            {companyName(id)}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                        <p className="text-xs text-gray-600"><strong>{companyName(activeCompany)}</strong> : {summary(user, activeCompany)}</p>
                        <div className="flex items-center gap-2">
                          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motif (facultatif)"
                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg w-44" />
                          {overrides.some(o => o.user_id === user.id && o.company_id === activeCompany) && (
                            <button onClick={() => setResetFor({ user, companyId: activeCompany })}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                              <RotateCcw className="w-3 h-3" /> Réinitialiser aux droits du rôle
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-gray-400 text-white flex items-center justify-center"><Check className="w-3 h-3" /></span> standard du rôle</span>
                        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-3 h-3" /></span> ajout personnel</span>
                        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-red-100 text-red-600 flex items-center justify-center"><Minus className="w-3 h-3" /></span> retrait personnel</span>
                        <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> réservé ou interdit</span>
                      </div>

                      <div className="mt-3 grid md:grid-cols-2 gap-x-6 gap-y-4">
                        {modules.map(g => (
                          <div key={g.module}>
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">{g.module}</p>
                            {g.entries.map(c => {
                              const st = cellState(user, activeCompany, c)
                              const locked = st === "reserved" || st === "forbidden"
                              const highlight = accessRequest?.userId === user.id && accessRequest.permission === c.key
                              return (
                                <button key={c.key} type="button" disabled={locked || busy === `${user.id}:${c.key}`} onClick={() => toggle(user, activeCompany, c)}
                                  title={st === "reserved" ? "Prérogative réservée au rôle" : st === "forbidden" ? (c.customizable ? "Jamais accordée à un Commercial" : "Prérogative réservée à un autre rôle") : undefined}
                                  className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs ${highlight ? "bg-amber-100" : "hover:bg-gray-50"} ${locked ? "cursor-default" : ""}`}>
                                  <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                                    st === "standard" || st === "reserved" ? "bg-gray-400 text-white"
                                      : st === "granted" ? "bg-emerald-600 text-white"
                                      : st === "denied" ? "bg-red-100 text-red-600"
                                      : "bg-gray-100 text-gray-300"}`}>
                                    {busy === `${user.id}:${c.key}` ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : st === "standard" || st === "reserved" ? <Check className="w-3 h-3" />
                                      : st === "granted" ? <Plus className="w-3 h-3" />
                                      : st === "denied" ? <Minus className="w-3 h-3" /> : null}
                                  </span>
                                  <span className={`flex-1 ${st === "denied" ? "line-through text-red-600" : st === "granted" ? "text-emerald-700 font-medium" : locked ? "text-gray-400" : "text-gray-700"}`}>{c.label}</span>
                                  {locked && <Lock className="w-3 h-3 text-gray-300" />}
                                </button>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
