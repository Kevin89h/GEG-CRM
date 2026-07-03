"use client"

import { useState } from "react"
import { Plus, UserCheck, Phone, Mail, Calendar, Percent, Banknote, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Badge } from "@/components/ui/Badge"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Commission {
  id: string
  amount: number
  currency: string
  rate: number
  status: "pending" | "paid"
  paid_date: string | null
  created_at: string
  invoice?: { number?: string } | null
  sales_order?: { number?: string } | null
}

interface Employee {
  id: string
  full_name: string
  title: string | null
  job_description: string | null
  start_date: string
  salary: number | null
  salary_currency: string
  commission_rate: number
  is_active: boolean
  email: string | null
  phone: string | null
  notes: string | null
  commissions?: Commission[]
}

interface TreasuryAccount { id: string; name: string; currency: string }

interface Props {
  employees: Employee[]
  treasuryAccounts: TreasuryAccount[]
}

const CURRENCIES = [
  { value: "GNF", label: "GNF — Franc guinéen" },
  { value: "USD", label: "USD — Dollar" },
  { value: "EUR", label: "EUR — Euro" },
]

const emptyForm = {
  full_name: "", title: "", job_description: "", start_date: new Date().toISOString().slice(0, 10),
  salary: "", salary_currency: "GNF", commission_rate: "0",
  email: "", phone: "", notes: "",
}

export default function EmployesClient({ employees: initial, treasuryAccounts }: Props) {
  const [employees, setEmployees] = useState(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [payModal, setPayModal] = useState<{ commissionId: string; amount: number; currency: string; employeeId: string } | null>(null)
  const [payForm, setPayForm] = useState({ treasury_account_id: "", paid_date: new Date().toISOString().slice(0, 10) })
  const [payError, setPayError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  function openNew() { setForm(emptyForm); setEditEmployee(null); setModalOpen(true) }
  function openEdit(e: Employee) {
    setForm({
      full_name: e.full_name, title: e.title ?? "", job_description: e.job_description ?? "",
      start_date: e.start_date, salary: String(e.salary ?? ""), salary_currency: e.salary_currency,
      commission_rate: String(e.commission_rate), email: e.email ?? "", phone: e.phone ?? "", notes: e.notes ?? "",
    })
    setEditEmployee(e)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.full_name || !form.start_date) return
    setSaving(true)
    setSaveError(null)
    const payload = {
      full_name: form.full_name,
      title: form.title || null,
      job_description: form.job_description || null,
      start_date: form.start_date,
      salary: form.salary ? parseFloat(form.salary) : null,
      salary_currency: form.salary_currency,
      commission_rate: parseFloat(form.commission_rate) || 0,
      email: form.email || null,
      phone: form.phone || null,
      notes: form.notes || null,
    }

    try {
      if (editEmployee) {
        const res = await fetch(`/api/employes/${editEmployee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) { setSaveError(data.error ?? "Erreur lors de la mise à jour"); setSaving(false); return }
        setEmployees(prev => prev.map(e => e.id === editEmployee.id ? { ...e, ...data } : e))
      } else {
        const res = await fetch("/api/employes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) { setSaveError(data.error ?? "Erreur lors de la création"); setSaving(false); return }
        setEmployees(prev => [...prev, { ...(data as Employee), commissions: [] }])
      }
      setModalOpen(false)
    } catch {
      setSaveError("Erreur réseau, veuillez réessayer")
    }
    setSaving(false)
  }

  async function toggleActive(emp: Employee) {
    // Optimistic update
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, is_active: !e.is_active } : e))
    const res = await fetch(`/api/employes/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !emp.is_active }),
    })
    if (!res.ok) {
      // Roll back on failure
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, is_active: emp.is_active } : e))
    }
  }

  async function payCommission() {
    if (!payModal || !payForm.treasury_account_id) return
    setPayError(null)
    const res = await fetch(`/api/employes/${payModal.employeeId}/pay-commission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commissionId: payModal.commissionId,
        amount: payModal.amount,
        currency: payModal.currency,
        treasury_account_id: payForm.treasury_account_id,
        paid_date: payForm.paid_date,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setPayError(data.error ?? "Erreur lors du paiement")
      return
    }
    setEmployees(prev => prev.map(e => {
      if (e.id !== payModal.employeeId) return e
      return {
        ...e,
        commissions: (e.commissions ?? []).map(c =>
          c.id === payModal.commissionId ? { ...c, status: "paid" as const, paid_date: payForm.paid_date } : c
        ),
      }
    }))
    setPayModal(null)
  }

  const active = employees.filter(e => e.is_active)
  const inactive = employees.filter(e => !e.is_active)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employés</h1>
          <p className="text-gray-500 text-sm mt-0.5">{active.length} actif{active.length !== 1 ? "s" : ""} · {inactive.length} inactif{inactive.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4" />Nouvel employé</Button>
      </div>

      <div className="space-y-3">
        {employees.map(emp => {
          const isExpanded = expanded === emp.id
          const pendingComm = (emp.commissions ?? []).filter(c => c.status === "pending")
          const pendingTotal = pendingComm.reduce((s, c) => s + c.amount, 0)
          const pendingCurrency = pendingComm[0]?.currency ?? "GNF"

          return (
            <div key={emp.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${emp.is_active ? "border-gray-100" : "border-gray-100 opacity-60"}`}>
              {/* Header row */}
              <div className="px-5 py-4 flex items-center gap-4">
                <button onClick={() => setExpanded(isExpanded ? null : emp.id)} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-700 font-bold text-sm">{emp.full_name.split(" ").map(n => n[0]).slice(0, 2).join("")}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{emp.full_name}</p>
                    {!emp.is_active && <Badge variant="gray">Inactif</Badge>}
                  </div>
                  <p className="text-sm text-gray-500">{emp.title ?? "—"}</p>
                </div>
                <div className="flex items-center gap-6 text-sm text-gray-500 flex-shrink-0">
                  {emp.salary && (
                    <div className="flex items-center gap-1">
                      <Banknote className="w-3.5 h-3.5" />
                      <span>{formatCurrency(emp.salary, emp.salary_currency as "GNF" | "USD" | "EUR")}/mois</span>
                    </div>
                  )}
                  {emp.commission_rate > 0 && (
                    <div className="flex items-center gap-1 text-amber-600">
                      <Percent className="w-3.5 h-3.5" />
                      <span>{emp.commission_rate}%</span>
                    </div>
                  )}
                  {pendingTotal > 0 && (
                    <div className="flex items-center gap-1 text-emerald-600 font-medium">
                      <span>{formatCurrency(pendingTotal, pendingCurrency as "GNF" | "USD" | "EUR")} à payer</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(emp)} className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded border border-gray-200 hover:border-blue-300">Modifier</button>
                    <button onClick={() => toggleActive(emp)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">
                      {emp.is_active ? "Désactiver" : "Réactiver"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-gray-50 px-5 py-4 bg-gray-50/50">
                  <div className="grid grid-cols-3 gap-6 mb-4">
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Informations</p>
                      <div className="space-y-1.5 text-sm">
                        {emp.email && <p className="flex items-center gap-1.5 text-gray-600"><Mail className="w-3.5 h-3.5" />{emp.email}</p>}
                        {emp.phone && <p className="flex items-center gap-1.5 text-gray-600"><Phone className="w-3.5 h-3.5" />{emp.phone}</p>}
                        <p className="flex items-center gap-1.5 text-gray-600"><Calendar className="w-3.5 h-3.5" />Depuis le {formatDate(emp.start_date, "fr")}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Poste</p>
                      <p className="text-sm text-gray-700">{emp.job_description ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Notes</p>
                      <p className="text-sm text-gray-700">{emp.notes ?? "—"}</p>
                    </div>
                  </div>

                  {/* Commissions */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Commissions</p>
                    {(emp.commissions ?? []).length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Aucune commission</p>
                    ) : (
                      <div className="space-y-1">
                        {(emp.commissions ?? []).map(c => (
                          <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white border border-gray-100 text-sm">
                            <div className="flex items-center gap-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {c.status === "paid" ? "Payée" : "En attente"}
                              </span>
                              <span className="font-medium text-gray-900">{formatCurrency(c.amount, c.currency as "GNF" | "USD" | "EUR")}</span>
                              <span className="text-gray-400 text-xs">({c.rate}%)</span>
                              {c.invoice && <span className="text-gray-400 text-xs">Facture {(c.invoice as { number?: string }).number}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-xs">{formatDate(c.created_at, "fr")}</span>
                              {c.status === "pending" && (
                                <button
                                  onClick={() => {
                                    setPayModal({ commissionId: c.id, amount: c.amount, currency: c.currency, employeeId: emp.id })
                                    setPayForm(f => ({ ...f, treasury_account_id: treasuryAccounts[0]?.id ?? "" }))
                                  }}
                                  className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                                >
                                  Payer
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {employees.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Aucun employé enregistré</p>
            <button onClick={openNew} className="mt-3 text-sm text-blue-600 hover:underline">Ajouter le premier employé</button>
          </div>
        )}
      </div>

      {/* Employee form modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editEmployee ? "Modifier l'employé" : "Nouvel employé"}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Nom complet *" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Mamadou Diallo" />
            <Input label="Titre / Fonction" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Commercial senior" />
          </div>
          <Input label="Description du poste" value={form.job_description} onChange={e => setForm(f => ({ ...f, job_description: e.target.value }))} placeholder="Responsable des ventes..." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Date d'embauche *" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Salaire mensuel" type="number" min="0" step="any" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="0" />
            <Select label="Devise salaire" value={form.salary_currency} onChange={e => setForm(f => ({ ...f, salary_currency: e.target.value }))} options={CURRENCIES} />
            <Input label="Taux commission (%)" type="number" min="0" max="100" step="0.1" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))} placeholder="0" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Téléphone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+224 620 000 000" />
            <Input label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optionnel" />
          </div>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.full_name || saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </div>
      </Modal>

      {/* Pay commission modal */}
      {payModal && (
        <Modal open={true} onClose={() => setPayModal(null)} title="Payer la commission">
          <div className="space-y-4">
            <div className="bg-emerald-50 rounded-lg p-4 text-center">
              <p className="text-sm text-emerald-600 font-medium">Montant à décaisser</p>
              <p className="text-2xl font-bold text-emerald-700">{formatCurrency(payModal.amount, payModal.currency as "GNF" | "USD" | "EUR")}</p>
            </div>
            <Select
              label="Compte de paiement"
              value={payForm.treasury_account_id}
              onChange={e => setPayForm(f => ({ ...f, treasury_account_id: e.target.value }))}
              options={treasuryAccounts.map(a => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
            />
            <Input label="Date de paiement" type="date" value={payForm.paid_date} onChange={e => setPayForm(f => ({ ...f, paid_date: e.target.value }))} />
            {payError && <p className="text-sm text-red-600">{payError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setPayModal(null)}>Annuler</Button>
              <Button onClick={payCommission} disabled={!payForm.treasury_account_id}>Confirmer le paiement</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
