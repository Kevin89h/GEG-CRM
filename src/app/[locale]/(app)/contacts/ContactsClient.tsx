"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Plus, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Badge } from "@/components/ui/Badge"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { initials } from "@/lib/utils"
import type { Contact } from "@/types"

type ContactWithAccount = Contact & { account: { id: string; name: string; type: string } | null }

interface Props {
  contacts: ContactWithAccount[]
  accounts: { id: string; name: string }[]
}

export default function ContactsClient({ contacts: initial, accounts }: Props) {
  const t = useTranslations("contacts")
  const [contacts, setContacts] = useState(initial)
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    first_name: "", last_name: "", title: "", email: "",
    phone: "", account_id: accounts[0]?.id ?? "", is_primary: false, notes: "",
  })

  const filtered = contacts.filter(c => {
    const full = `${c.first_name} ${c.last_name} ${c.email ?? ""} ${c.account?.name ?? ""}`.toLowerCase()
    return full.includes(search.toLowerCase())
  })

  async function handleSave() {
    setSaving(true)
    const { supabase, db } = getCompanyClientBrowser()
    const { data, error } = await supabase
      .from("contacts")
      .insert([form])
      .select("*, account:accounts(id, name, type)")
      .single()
    if (!error && data) {
      setContacts(prev => [data, ...prev])
      setModalOpen(false)
      setForm({ first_name: "", last_name: "", title: "", email: "", phone: "", account_id: accounts[0]?.id ?? "", is_primary: false, notes: "" })
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} contact{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          {t("new")}
        </Button>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("search")}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{t("noContacts")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-semibold">
                    {initials(`${c.first_name} ${c.last_name}`)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">
                    {c.first_name} {c.last_name}
                  </p>
                  {c.title && <p className="text-xs text-gray-500 truncate">{c.title}</p>}
                  {c.account && (
                    <p className="text-xs text-blue-600 mt-0.5 truncate">{c.account.name}</p>
                  )}
                </div>
                {c.is_primary && <Badge variant="blue">Principal</Badge>}
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray-500">
                {c.email && <p className="truncate">✉ {c.email}</p>}
                {c.phone && <p>📞 {c.phone}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("newContact")}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t("firstName")}
              value={form.first_name}
              onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              required
            />
            <Input
              label={t("lastName")}
              value={form.last_name}
              onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              required
            />
          </div>
          <Input
            label={t("title_field")}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Directeur Général, Ministre..."
          />
          <Select
            label={t("account")}
            value={form.account_id}
            onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
            options={accounts.map(a => ({ value: a.id, label: a.name }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t("email")}
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
            <Input
              label={t("phone")}
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_primary}
              onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {t("primary")}
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.first_name || !form.last_name || saving}>{t("save")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
