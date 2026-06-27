"use client"

import { useState } from "react"
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Banknote, Smartphone, Building2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Modal } from "@/components/ui/Modal"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatCurrency, formatDate } from "@/lib/utils"

interface TreasuryAccount {
  id: string
  name: string
  type: string
  institution: string | null
  currency: string
  color: string
  is_active: boolean
  balance: number
  total_in: number
  total_out: number
}

interface Transaction {
  id: string
  account_id: string
  type: string
  amount: number
  currency: string
  description: string
  reference: string | null
  category: string | null
  date: string
}

interface Props {
  accounts: TreasuryAccount[]
  transactions: Transaction[]
}

const typeIcon = { bank: Building2, mobile_money: Smartphone, cash: Banknote }
const typeLabel = { bank: "Banque", mobile_money: "Mobile Money", cash: "Caisse" }
const colorMap: Record<string, string> = {
  blue: "from-blue-500 to-blue-600",
  green: "from-emerald-500 to-emerald-600",
  orange: "from-orange-400 to-orange-500",
  purple: "from-purple-500 to-purple-600",
  gray: "from-gray-500 to-gray-600",
  red: "from-red-500 to-red-600",
}

const txTypeConfig = {
  credit: { label: "Entrée", icon: ArrowDownLeft, color: "text-emerald-600" },
  debit: { label: "Sortie", icon: ArrowUpRight, color: "text-red-500" },
  transfer_in: { label: "Virement reçu", icon: ArrowDownLeft, color: "text-blue-600" },
  transfer_out: { label: "Virement émis", icon: ArrowUpRight, color: "text-amber-600" },
}

export default function TresorerieClient({ accounts: initial, transactions: initialTx }: Props) {
  const [accounts, setAccounts] = useState(initial)
  const [transactions, setTransactions] = useState(initialTx)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [txModal, setTxModal] = useState(false)
  const [accountModal, setAccountModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [txForm, setTxForm] = useState({
    account_id: accounts[0]?.id ?? "",
    type: "credit" as "credit" | "debit" | "transfer_out",
    amount: "",
    currency: "GNF" as "GNF" | "USD" | "EUR",
    description: "",
    reference: "",
    category: "",
    transfer_account_id: "",
    date: new Date().toISOString().split("T")[0],
  })

  const [accForm, setAccForm] = useState({
    name: "", type: "bank" as "bank" | "mobile_money" | "cash",
    institution: "", account_number: "",
    currency: "GNF" as "GNF" | "USD" | "EUR",
    initial_balance: "0", color: "blue",
  })

  const totalByCurrency = accounts
    .filter(a => a.is_active)
    .reduce<Record<string, number>>((acc, a) => {
      acc[a.currency] = (acc[a.currency] ?? 0) + a.balance
      return acc
    }, {})

  const filtered = selectedAccount
    ? transactions.filter(t => t.account_id === selectedAccount)
    : transactions

  async function saveTransaction() {
    if (!txForm.amount || !txForm.description) return
    setSaving(true)
    const { supabase, db } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const isTransfer = txForm.type === "transfer_out"
    const rows: Record<string, unknown>[] = [{
      account_id: txForm.account_id,
      type: txForm.type,
      amount: parseFloat(txForm.amount),
      currency: txForm.currency,
      description: txForm.description,
      reference: txForm.reference || null,
      category: txForm.category || null,
      transfer_account_id: isTransfer ? txForm.transfer_account_id : null,
      date: new Date(txForm.date).toISOString(),
      user_id: user.id,
    }]

    if (isTransfer && txForm.transfer_account_id) {
      rows.push({
        account_id: txForm.transfer_account_id,
        type: "transfer_in",
        amount: parseFloat(txForm.amount),
        currency: txForm.currency,
        description: txForm.description,
        reference: txForm.reference || null,
        category: txForm.category || null,
        transfer_account_id: txForm.account_id,
        date: new Date(txForm.date).toISOString(),
        user_id: user.id,
      })
    }

    const { data } = await db.from("treasury_transactions").insert(rows).select("*")
    if (data) {
      setTransactions(prev => [...(data as Transaction[]), ...prev])
      // Recalculate balances client-side
      const amt = parseFloat(txForm.amount)
      setAccounts(prev => prev.map(a => {
        if (a.id === txForm.account_id) {
          const delta = txForm.type === "credit" ? amt : -amt
          return { ...a, balance: a.balance + delta }
        }
        if (isTransfer && a.id === txForm.transfer_account_id) {
          return { ...a, balance: a.balance + amt }
        }
        return a
      }))
    }
    setTxModal(false)
    setSaving(false)
  }

  async function saveAccount() {
    if (!accForm.name) return
    setSaving(true)
    const { supabase, db } = getCompanyClientBrowser()
    const { data } = await db.from("treasury_accounts").insert([{
      name: accForm.name,
      type: accForm.type,
      institution: accForm.institution || null,
      account_number: accForm.account_number || null,
      currency: accForm.currency,
      initial_balance: parseFloat(accForm.initial_balance) || 0,
      color: accForm.color,
    }]).select("*").single()

    if (data) {
      setAccounts(prev => [...prev, { ...data, balance: data.initial_balance, total_in: 0, total_out: 0 }])
      setAccountModal(false)
      setAccForm({ name: "", type: "bank", institution: "", account_number: "", currency: "GNF", initial_balance: "0", color: "blue" })
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trésorerie</h1>
          <p className="text-gray-500 text-sm mt-0.5">Soldes en temps réel</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setAccountModal(true)}>
            <Plus className="w-4 h-4" /> Nouveau compte
          </Button>
          <Button onClick={() => setTxModal(true)}>
            <Plus className="w-4 h-4" /> Mouvement
          </Button>
        </div>
      </div>

      {/* Totaux globaux */}
      {Object.entries(totalByurrency(accounts)).length > 0 && (
        <div className="flex gap-3 mb-6">
          {Object.entries(totalByurrency(accounts)).map(([cur, total]) => (
            <div key={cur} className="bg-slate-900 rounded-xl px-6 py-4 text-white">
              <p className="text-slate-400 text-xs mb-1">Total trésorerie {cur}</p>
              <p className="text-2xl font-bold">{formatCurrency(total, cur as "GNF" | "USD" | "EUR")}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cartes comptes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {accounts.map(a => {
          const Icon = typeIcon[a.type as keyof typeof typeIcon] ?? Banknote
          const gradient = colorMap[a.color] ?? colorMap.blue
          const isSelected = selectedAccount === a.id
          return (
            <button
              key={a.id}
              onClick={() => setSelectedAccount(isSelected ? null : a.id)}
              className={`text-left rounded-2xl overflow-hidden shadow-sm transition-all ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : "hover:shadow-md"}`}
            >
              <div className={`bg-gradient-to-br ${gradient} p-5 text-white`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-lg leading-tight">{a.name}</p>
                    <p className="text-white/70 text-xs mt-0.5">{a.institution ?? typeLabel[a.type as keyof typeof typeLabel]}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight">
                  {formatCurrency(a.balance, a.currency as "GNF" | "USD" | "EUR")}
                </p>
                <p className="text-white/60 text-xs mt-1">{a.currency}</p>
              </div>
              <div className="bg-white border-x border-b border-gray-100 px-5 py-3 flex justify-between text-xs">
                <span className="text-emerald-600 font-medium">↓ {formatCurrency(a.total_in, a.currency as "GNF" | "USD" | "EUR")}</span>
                <span className="text-red-500 font-medium">↑ {formatCurrency(a.total_out, a.currency as "GNF" | "USD" | "EUR")}</span>
              </div>
            </button>
          )
        })}

        {/* Ajouter compte */}
        <button
          onClick={() => setAccountModal(true)}
          className="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex items-center justify-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors min-h-[140px]"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">Ajouter un compte</span>
        </button>
      </div>

      {/* Journal des mouvements */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">
            {selectedAccount
              ? `Mouvements — ${accounts.find(a => a.id === selectedAccount)?.name}`
              : "Tous les mouvements"}
          </h2>
          {selectedAccount && (
            <button onClick={() => setSelectedAccount(null)} className="text-xs text-blue-600 hover:underline">
              Voir tout
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="text-center py-12 text-gray-400 text-sm">Aucun mouvement</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Compte</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Catégorie</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.slice(0, 100).map(t => {
                const cfg = txTypeConfig[t.type as keyof typeof txTypeConfig]
                const Icon = cfg?.icon ?? ArrowDownLeft
                const accountName = accounts.find(a => a.id === t.account_id)?.name ?? "—"
                const isCredit = t.type === "credit" || t.type === "transfer_in"
                return (
                  <tr key={t.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(t.date, "fr")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isCredit ? "bg-emerald-50" : "bg-red-50"}`}>
                          <Icon className={`w-3.5 h-3.5 ${cfg?.color ?? ""}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{t.description}</p>
                          {t.reference && <p className="text-xs text-gray-400 font-mono">{t.reference}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{accountName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.category ?? "—"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${isCredit ? "text-emerald-700" : "text-red-600"}`}>
                      {isCredit ? "+" : "−"}{formatCurrency(t.amount, t.currency as "GNF" | "USD" | "EUR")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Modal mouvement */}
      <Modal open={txModal} onClose={() => setTxModal(false)} title="Nouveau mouvement">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(["credit", "debit", "transfer_out"] as const).map(type => (
              <button
                key={type}
                onClick={() => setTxForm(f => ({ ...f, type }))}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition ${txForm.type === type ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600"}`}
              >
                {type === "credit" ? "Entrée" : type === "debit" ? "Sortie" : "Virement interne"}
              </button>
            ))}
          </div>

          <Select
            label="Compte"
            value={txForm.account_id}
            onChange={e => setTxForm(f => ({ ...f, account_id: e.target.value }))}
            options={accounts.map(a => ({ value: a.id, label: `${a.name} (${formatCurrency(a.balance, a.currency as "GNF"|"USD"|"EUR")})` }))}
          />

          {txForm.type === "transfer_out" && (
            <Select
              label="Compte destination"
              value={txForm.transfer_account_id}
              onChange={e => setTxForm(f => ({ ...f, transfer_account_id: e.target.value }))}
              options={[
                { value: "", label: "Choisir…" },
                ...accounts.filter(a => a.id !== txForm.account_id).map(a => ({ value: a.id, label: a.name })),
              ]}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Montant"
              type="number" min="0" step="any"
              value={txForm.amount}
              onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
            />
            <Select
              label="Devise"
              value={txForm.currency}
              onChange={e => setTxForm(f => ({ ...f, currency: e.target.value as "GNF"|"USD"|"EUR" }))}
              options={[{ value: "GNF", label: "GNF" }, { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }]}
            />
          </div>

          <Input
            label="Description"
            value={txForm.description}
            onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Loyer, frais bancaires, recette vente..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Référence"
              value={txForm.reference}
              onChange={e => setTxForm(f => ({ ...f, reference: e.target.value }))}
              placeholder="N° chèque, reçu..."
            />
            <Input
              label="Date"
              type="date"
              value={txForm.date}
              onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setTxModal(false)}>Annuler</Button>
            <Button onClick={saveTransaction} disabled={saving || !txForm.amount || !txForm.description}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal nouveau compte */}
      <Modal open={accountModal} onClose={() => setAccountModal(false)} title="Nouveau compte de trésorerie">
        <div className="space-y-4">
          <Input label="Nom du compte *" value={accForm.name} onChange={e => setAccForm(f => ({ ...f, name: e.target.value }))} placeholder="Ecobank GNF, Orange Money, Caisse principale…" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Type"
              value={accForm.type}
              onChange={e => setAccForm(f => ({ ...f, type: e.target.value as "bank"|"mobile_money"|"cash" }))}
              options={[{ value: "bank", label: "Banque" }, { value: "mobile_money", label: "Mobile Money" }, { value: "cash", label: "Caisse" }]}
            />
            <Select
              label="Devise"
              value={accForm.currency}
              onChange={e => setAccForm(f => ({ ...f, currency: e.target.value as "GNF"|"USD"|"EUR" }))}
              options={[{ value: "GNF", label: "GNF" }, { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }]}
            />
          </div>
          <Input label="Institution" value={accForm.institution} onChange={e => setAccForm(f => ({ ...f, institution: e.target.value }))} placeholder="Ecobank, Orange Money…" />
          <Input label="Numéro de compte / téléphone" value={accForm.account_number} onChange={e => setAccForm(f => ({ ...f, account_number: e.target.value }))} />
          <Input label="Solde initial" type="number" value={accForm.initial_balance} onChange={e => setAccForm(f => ({ ...f, initial_balance: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Couleur</label>
            <div className="flex gap-2">
              {["blue","green","orange","purple","gray","red"].map(c => (
                <button key={c} onClick={() => setAccForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${colorMap[c]} transition-transform ${accForm.color === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setAccountModal(false)}>Annuler</Button>
            <Button onClick={saveAccount} disabled={saving || !accForm.name}>Créer le compte</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function totalByurrency(accounts: TreasuryAccount[]) {
  return accounts.filter(a => a.is_active).reduce<Record<string, number>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] ?? 0) + a.balance
    return acc
  }, {})
}
