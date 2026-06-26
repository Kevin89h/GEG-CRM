"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Plus, Search, Building2, Landmark, Briefcase } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import type { Account, AccountType } from "@/types"

interface Employee { id: string; full_name: string }
interface Props {
  accounts: (Account & { contacts: [{ count: number }]; deals: [{ count: number }]; salesperson_id?: string | null })[]
  employees: Employee[]
}

const typeConfig: Record<AccountType, { label: string; color: "blue" | "purple" | "green"; Icon: React.ElementType }> = {
  government: { label: "", color: "blue", Icon: Landmark },
  enterprise: { label: "", color: "purple", Icon: Briefcase },
  sme: { label: "", color: "green", Icon: Building2 },
}

export default function AccountsClient({ accounts: initial, employees }: Props) {
  const t = useTranslations("accounts")
  const router = useRouter()
  const [accounts, setAccounts] = useState(initial)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<AccountType | "all">("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: "", type: "enterprise" as AccountType, industry: "",
    country: "Guinée", city: "", phone: "", email: "", website: "", notes: "",
    salesperson_id: "",
  })

  const filtered = accounts.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.industry ?? "").toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === "all" || a.type === filterType
    return matchSearch && matchType
  })

  async function handleSave() {
    setSaving(true)
    const { supabase, db } = getCompanyClientBrowser()
    const { data, error } = await supabase
      .from("accounts")
      .insert([{ ...form, salesperson_id: form.salesperson_id || null }])
      .select("*, contacts(count), deals(count)")
      .single()
    if (!error && data) {
      setAccounts(prev => [data, ...prev])
      setModalOpen(false)
      setForm({ name: "", type: "enterprise", industry: "", country: "Guinée", city: "", phone: "", email: "", website: "", notes: "", salesperson_id: "" })
    }
    setSaving(false)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} compte{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          {t("new")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("search")}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "government", "enterprise", "sme"] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition ${
                filterType === type
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{t("noAccounts")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("name")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("type")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("industry")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("country")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("contacts")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("deals")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(account => {
                const cfg = typeConfig[account.type]
                return (
                  <tr
                    key={account.id}
                    onClick={() => router.push(`accounts/${account.id}`)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <cfg.Icon className="w-4 h-4 text-gray-500" />
                        </div>
                        <span className="font-medium text-gray-900">{account.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={cfg.color}>{t(account.type)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{account.industry ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{account.country}</td>
                    <td className="px-4 py-3 text-gray-600">{account.contacts?.[0]?.count ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600">{account.deals?.[0]?.count ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Account Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("newAccount")}>
        <div className="space-y-4">
          <Input
            label={t("name")}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          <Select
            label={t("type")}
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}
            options={[
              { value: "government", label: t("government") },
              { value: "enterprise", label: t("enterprise") },
              { value: "sme", label: t("sme") },
            ]}
          />
          <Input
            label={t("industry")}
            value={form.industry}
            onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("country")}
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
            />
            <Input
              label="Ville"
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("phone")}
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label={t("email")}
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <Select
            label={t("salesperson")}
            value={form.salesperson_id}
            onChange={e => setForm(f => ({ ...f, salesperson_id: e.target.value }))}
            options={[{ value: "", label: "— Aucun commercial —" }, ...employees.map(e => ({ value: e.id, label: e.full_name }))]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.name || saving}>{t("save")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
