"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Building2, Smartphone, Banknote, ArrowDownLeft, ArrowUpRight, MoreVertical, X } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Modal } from "@/components/ui/Modal"

/* ─── Types ─────────────────────────────────────────────── */
interface InvoiceStat { id: string; status: string; currency: string; total_ht: number; balance: number; due_date: string | null }
interface PurchaseStat { id: string; status: string; currency: string; total_ht: number }

interface TreasuryAccount {
  id: string; name: string; type: string; institution: string | null
  currency: string; color: string; is_active: boolean
  balance: number; total_in: number; total_out: number
}

interface Transaction {
  id: string; account_id: string; type: string; amount: number
  currency: string; description: string; reference: string | null
  category: string | null; date: string
}

interface Props {
  locale: string
  clientStats: {
    draft: InvoiceStat[]; unpaid: InvoiceStat[]; overdue: InvoiceStat[]
    draftAmount: number; unpaidAmount: number; overdueAmount: number
  }
  purchaseStats: {
    draft: PurchaseStat[]; toPay: PurchaseStat[]
    draftAmount: number; toPayAmount: number
  }
  accounts: TreasuryAccount[]
  transactions: Transaction[]
}

const colorGradient: Record<string, string> = {
  blue:   "from-blue-500 to-blue-600",
  green:  "from-emerald-500 to-emerald-600",
  orange: "from-orange-400 to-orange-500",
  purple: "from-purple-500 to-purple-600",
  gray:   "from-gray-500 to-gray-600",
  red:    "from-red-500 to-red-600",
}
const typeIcon = { bank: Building2, mobile_money: Smartphone, cash: Banknote }

const txTypeConfig = {
  credit:       { label: "Entrée",         icon: ArrowDownLeft, color: "text-emerald-600", credit: true },
  debit:        { label: "Sortie",          icon: ArrowUpRight,  color: "text-red-500",     credit: false },
  transfer_in:  { label: "Virement reçu",  icon: ArrowDownLeft, color: "text-blue-600",    credit: true },
  transfer_out: { label: "Virement émis",  icon: ArrowUpRight,  color: "text-amber-600",   credit: false },
}

/* ─── Carte "Factures clients" style Odoo ─────────────── */
function InvoiceCard({ locale, stats }: { locale: string; stats: Props["clientStats"] }) {
  const total = stats.draft.length + stats.unpaid.length
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div>
          <h2 className="text-base font-semibold text-blue-700">Factures clients</h2>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/${locale}/ventes/factures/nouveau`}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors"
          >
            Nouveau
          </Link>
          <button className="p-1.5 text-gray-400 hover:text-gray-600"><MoreVertical className="w-4 h-4" /></button>
        </div>
      </div>

      {total === 0 ? (
        <div className="px-5 pb-5 text-sm text-gray-400">Aucune facture en cours</div>
      ) : (
        <div className="px-5 pb-3 space-y-2">
          {stats.draft.length > 0 && (
            <Link href={`/${locale}/ventes/factures`} className="flex justify-between items-center hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors group">
              <span className="text-sm font-medium text-blue-600 group-hover:underline">
                {stats.draft.length} À valider
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {stats.draftAmount.toLocaleString("fr", { maximumFractionDigits: 0 })} FG
              </span>
            </Link>
          )}
          {stats.unpaid.length > 0 && (
            <Link href={`/${locale}/ventes/factures`} className="flex justify-between items-center hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors group">
              <span className="text-sm font-medium text-amber-600 group-hover:underline">
                {stats.unpaid.length} Non payé{stats.unpaid.length > 1 ? "s" : ""}
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {stats.unpaidAmount.toLocaleString("fr", { maximumFractionDigits: 0 })} FG
              </span>
            </Link>
          )}
          {stats.overdue.length > 0 && (
            <Link href={`/${locale}/ventes/factures`} className="flex justify-between items-center hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors group">
              <span className="text-sm font-medium text-red-600 group-hover:underline">
                {stats.overdue.length} En retard
              </span>
              <span className="text-sm font-semibold text-red-700">
                {stats.overdueAmount.toLocaleString("fr", { maximumFractionDigits: 0 })} FG
              </span>
            </Link>
          )}
        </div>
      )}

      {/* Mini bar chart style Odoo */}
      <MiniBarChart invoices={stats.unpaid} />
    </div>
  )
}

/* ─── Carte "Factures fournisseurs" style Odoo ────────── */
function PurchaseCard({ locale, stats }: { locale: string; stats: Props["purchaseStats"] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div>
          <h2 className="text-base font-semibold text-blue-700">Factures fournisseurs</h2>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/${locale}/comptabilite/factures-fournisseurs/nouveau`}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors"
          >
            Nouveau
          </Link>
          <button className="p-1.5 text-gray-400 hover:text-gray-600"><MoreVertical className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="px-5 pb-3 space-y-2">
        {stats.draft.length > 0 ? (
          <Link href={`/${locale}/comptabilite/factures-fournisseurs`} className="flex justify-between items-center hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors group">
            <span className="text-sm font-medium text-blue-600 group-hover:underline">
              {stats.draft.length} À valider
            </span>
            <span className="text-sm font-semibold text-gray-800">
              {stats.draftAmount.toLocaleString("fr", { maximumFractionDigits: 0 })} FG
            </span>
          </Link>
        ) : null}
        {stats.toPay.length > 0 ? (
          <Link href={`/${locale}/comptabilite/factures-fournisseurs`} className="flex justify-between items-center hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors group">
            <span className="text-sm font-medium text-amber-600 group-hover:underline">
              {stats.toPay.length} À payer
            </span>
            <span className="text-sm font-semibold text-gray-800">
              {stats.toPayAmount.toLocaleString("fr", { maximumFractionDigits: 0 })} FG
            </span>
          </Link>
        ) : null}
        {stats.draft.length === 0 && stats.toPay.length === 0 && (
          <p className="text-sm text-gray-400">Aucune commande en cours</p>
        )}
      </div>

      <div className="flex-1 px-5 pb-5 pt-2">
        <div className="h-20 flex items-end gap-1.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`flex-1 rounded-t-sm bg-purple-100`} style={{ height: `${20 + Math.random() * 60}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Mini bar chart ──────────────────────────────────── */
function MiniBarChart({ invoices }: { invoices: InvoiceStat[] }) {
  const buckets = [
    { label: "Dû",            color: "bg-red-400" },
    { label: "15-21 juin",    color: "bg-amber-300" },
    { label: "Cette semaine", color: "bg-blue-300" },
    { label: "29 juin-5 jul", color: "bg-teal-300" },
    { label: "6-12 jul",      color: "bg-emerald-300" },
    { label: "Pas dû",        color: "bg-gray-200" },
  ]
  // Valeurs simulées basées sur le nombre de factures
  const base = invoices.length
  const heights = [base * 15, base * 8, base * 5, base * 3, base * 2, base * 1].map(h => Math.min(100, h + 10))

  return (
    <div className="mt-auto px-5 pb-5 pt-2">
      <div className="h-20 flex items-end gap-1.5">
        {buckets.map((b, i) => (
          <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-full rounded-t-sm ${b.color}`} style={{ height: `${heights[i]}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {buckets.map(b => (
          <div key={b.label} className="flex-1 text-center text-[9px] text-gray-400 leading-tight truncate">
            {b.label}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Carte compte bancaire style Odoo ───────────────── */
function BankCard({ account, locale, onTransact }: {
  account: TreasuryAccount
  locale: string
  onTransact: (accountId: string) => void
}) {
  const Icon = typeIcon[account.type as keyof typeof typeIcon] ?? Banknote
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-base font-semibold text-blue-700 mb-3">{account.name}</h3>
        <div className="flex gap-2 mb-4">
          <button className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5" /> Configuration de la banque
          </button>
          <button
            onClick={() => onTransact(account.id)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Transactions
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-amber-600 font-medium mb-0.5">Solde</p>
            <p className="font-bold text-gray-900">
              {formatCurrency(account.balance, account.currency as "GNF" | "USD" | "EUR")}
            </p>
          </div>
          <div>
            <p className="text-xs text-amber-600 font-medium mb-0.5">Paiements</p>
            <p className="font-bold text-gray-900">
              {formatCurrency(account.total_out, account.currency as "GNF" | "USD" | "EUR")}
            </p>
          </div>
        </div>
      </div>

      {/* Mini sparkline */}
      <div className="px-5 pb-4 pt-1">
        <div className="h-12 flex items-end gap-0.5 opacity-60">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t-sm ${account.color === "purple" ? "bg-purple-300" : account.color === "blue" ? "bg-blue-300" : "bg-emerald-300"}`}
              style={{ height: `${20 + Math.sin(i * 0.5 + (account.balance % 3)) * 30 + 30}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Drawer transactions ─────────────────────────────── */
function TransactionsDrawer({ accountId, accounts, transactions, onClose, onNewTx }: {
  accountId: string
  accounts: TreasuryAccount[]
  transactions: Transaction[]
  onClose: () => void
  onNewTx: () => void
}) {
  const account = accounts.find(a => a.id === accountId)
  const filtered = transactions.filter(t => t.account_id === accountId)

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">{account?.name}</h2>
            <p className="text-sm text-gray-500">
              Solde : <span className="font-semibold text-gray-900">
                {account ? formatCurrency(account.balance, account.currency as "GNF"|"USD"|"EUR") : "—"}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={onNewTx} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Mouvement
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-sm">Aucune transaction</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Date</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Description</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(t => {
                  const isCredit = t.type === "credit" || t.type === "transfer_in"
                  return (
                    <tr key={t.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(t.date, "fr")}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800 text-sm">{t.description}</p>
                        {t.reference && <p className="text-xs text-gray-400 font-mono">{t.reference}</p>}
                      </td>
                      <td className={`px-5 py-3 text-right font-semibold text-sm whitespace-nowrap ${isCredit ? "text-emerald-700" : "text-red-600"}`}>
                        {isCredit ? "+" : "−"}{formatCurrency(t.amount, t.currency as "GNF"|"USD"|"EUR")}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Composant principal ────────────────────────────── */
export default function ComptabiliteClient({ locale, clientStats, purchaseStats, accounts, transactions }: Props) {
  const router = useRouter()
  const [drawerAccountId, setDrawerAccountId] = useState<string | null>(null)
  const [txModal, setTxModal] = useState(false)
  const [accountModal, setAccountModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [txForm, setTxForm] = useState({
    account_id: accounts[0]?.id ?? "",
    type: "credit" as "credit" | "debit" | "transfer_out",
    amount: "", currency: "GNF" as "GNF" | "USD" | "EUR",
    description: "", reference: "",
    transfer_account_id: "",
    date: new Date().toISOString().split("T")[0],
  })

  const [accForm, setAccForm] = useState({
    name: "", type: "bank" as "bank" | "mobile_money" | "cash",
    institution: "", account_number: "",
    currency: "GNF" as "GNF" | "USD" | "EUR",
    initial_balance: "0", color: "blue",
  })

  const totalByCurrency = accounts.reduce<Record<string, number>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] ?? 0) + a.balance
    return acc
  }, {})

  async function saveTransaction() {
    if (!txForm.amount || !txForm.description) return
    setSaving(true)
    const { supabase, db } = getCompanyClientBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const isTransfer = txForm.type === "transfer_out"
    const rows: Record<string, unknown>[] = [{
      account_id: txForm.account_id, type: txForm.type,
      amount: parseFloat(txForm.amount), currency: txForm.currency,
      description: txForm.description, reference: txForm.reference || null,
      transfer_account_id: isTransfer ? txForm.transfer_account_id : null,
      date: new Date(txForm.date).toISOString(), user_id: user.id,
    }]
    if (isTransfer && txForm.transfer_account_id) {
      rows.push({ account_id: txForm.transfer_account_id, type: "transfer_in", amount: parseFloat(txForm.amount), currency: txForm.currency, description: txForm.description, reference: txForm.reference || null, transfer_account_id: txForm.account_id, date: new Date(txForm.date).toISOString(), user_id: user.id })
    }
    await db.from("treasury_transactions").insert(rows)
    setTxModal(false)
    setSaving(false)
    router.refresh()
  }

  async function saveAccount() {
    if (!accForm.name) return
    setSaving(true)
    const { db } = getCompanyClientBrowser()
    await db.from("treasury_accounts").insert([{
      name: accForm.name, type: accForm.type, institution: accForm.institution || null,
      account_number: accForm.account_number || null, currency: accForm.currency,
      initial_balance: parseFloat(accForm.initial_balance) || 0, color: accForm.color,
    }])
    setAccountModal(false)
    setSaving(false)
    router.refresh()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Comptabilité</h1>
          <p className="text-gray-500 text-sm mt-0.5">Tableau de bord</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAccountModal(true)} className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Nouveau compte
          </button>
          <button onClick={() => setTxModal(true)} className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Mouvement
          </button>
        </div>
      </div>

      {/* Totaux globaux */}
      {Object.keys(totalByCurrency).length > 0 && (
        <div className="flex gap-3 mb-6 flex-wrap">
          {Object.entries(totalByCurrency).map(([cur, total]) => (
            <div key={cur} className="bg-slate-900 rounded-xl px-5 py-3 text-white">
              <p className="text-slate-400 text-xs mb-0.5">Trésorerie totale {cur}</p>
              <p className="text-xl font-bold">{formatCurrency(total, cur as "GNF"|"USD"|"EUR")}</p>
            </div>
          ))}
        </div>
      )}

      {/* Ligne 1 : Factures clients | Factures fournisseurs | Opérations diverses */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <InvoiceCard locale={locale} stats={clientStats} />
        <PurchaseCard locale={locale} stats={purchaseStats} />

        {/* Opérations diverses */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Opérations diverses</h2>
          <div className="space-y-3">
            <button
              onClick={() => setTxModal(true)}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            >
              <Plus className="w-4 h-4 text-gray-400" /> Nouveau mouvement
            </button>
            <Link
              href={`/${locale}/ventes/factures`}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-500" /> Toutes les factures clients
            </Link>
            <Link
              href={`/${locale}/achats`}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            >
              <ArrowUpRight className="w-4 h-4 text-red-500" /> Toutes les factures fournisseurs
            </Link>
          </div>
        </div>
      </div>

      {/* Ligne 2 : Comptes bancaires style Odoo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {accounts.map(account => (
          <BankCard
            key={account.id}
            account={account}
            locale={locale}
            onTransact={(id) => setDrawerAccountId(id)}
          />
        ))}

        {/* Ajouter un compte */}
        <button
          onClick={() => setAccountModal(true)}
          className="min-h-[160px] border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">Ajouter un compte</span>
        </button>
      </div>

      {/* Drawer transactions */}
      {drawerAccountId && (
        <TransactionsDrawer
          accountId={drawerAccountId}
          accounts={accounts}
          transactions={transactions}
          onClose={() => setDrawerAccountId(null)}
          onNewTx={() => {
            setTxForm(f => ({ ...f, account_id: drawerAccountId }))
            setTxModal(true)
          }}
        />
      )}

      {/* Modal nouveau mouvement */}
      <Modal open={txModal} onClose={() => setTxModal(false)} title="Nouveau mouvement">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 min-w-0">
            {(["credit", "debit", "transfer_out"] as const).map(type => (
              <button key={type} onClick={() => setTxForm(f => ({ ...f, type }))}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition ${txForm.type === type ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                {type === "credit" ? "Entrée" : type === "debit" ? "Sortie" : "Virement"}
              </button>
            ))}
          </div>
          <Select label="Compte" value={txForm.account_id} onChange={e => setTxForm(f => ({ ...f, account_id: e.target.value }))}
            options={accounts.map(a => ({ value: a.id, label: `${a.name} (${formatCurrency(a.balance, a.currency as "GNF"|"USD"|"EUR")})` }))} />
          {txForm.type === "transfer_out" && (
            <Select label="Compte destination" value={txForm.transfer_account_id} onChange={e => setTxForm(f => ({ ...f, transfer_account_id: e.target.value }))}
              options={[{ value: "", label: "Choisir…" }, ...accounts.filter(a => a.id !== txForm.account_id).map(a => ({ value: a.id, label: a.name }))]} />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Montant" type="number" min="0" step="any" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} />
            <Select label="Devise" value={txForm.currency} onChange={e => setTxForm(f => ({ ...f, currency: e.target.value as "GNF"|"USD"|"EUR" }))}
              options={[{ value: "GNF", label: "GNF" }, { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }]} />
          </div>
          <Input label="Description" value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} placeholder="Loyer, frais, virement client…" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Référence" value={txForm.reference} onChange={e => setTxForm(f => ({ ...f, reference: e.target.value }))} placeholder="N° chèque, reçu…" />
            <Input label="Date" type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} />
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
      <Modal open={accountModal} onClose={() => setAccountModal(false)} title="Nouveau compte">
        <div className="space-y-4">
          <Input label="Nom du compte *" value={accForm.name} onChange={e => setAccForm(f => ({ ...f, name: e.target.value }))} placeholder="Ecobank GNF, Orange Money, Caisse…" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Type" value={accForm.type} onChange={e => setAccForm(f => ({ ...f, type: e.target.value as "bank"|"mobile_money"|"cash" }))}
              options={[{ value: "bank", label: "Banque" }, { value: "mobile_money", label: "Mobile Money" }, { value: "cash", label: "Caisse" }]} />
            <Select label="Devise" value={accForm.currency} onChange={e => setAccForm(f => ({ ...f, currency: e.target.value as "GNF"|"USD"|"EUR" }))}
              options={[{ value: "GNF", label: "GNF" }, { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }]} />
          </div>
          <Input label="Institution" value={accForm.institution} onChange={e => setAccForm(f => ({ ...f, institution: e.target.value }))} placeholder="Ecobank, Orange Money…" />
          <Input label="N° de compte / téléphone" value={accForm.account_number} onChange={e => setAccForm(f => ({ ...f, account_number: e.target.value }))} />
          <Input label="Solde initial" type="number" value={accForm.initial_balance} onChange={e => setAccForm(f => ({ ...f, initial_balance: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Couleur</label>
            <div className="flex gap-2">
              {["blue","green","orange","purple","gray","red"].map(c => (
                <button key={c} onClick={() => setAccForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${colorGradient[c]} transition-transform ${accForm.color === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
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
