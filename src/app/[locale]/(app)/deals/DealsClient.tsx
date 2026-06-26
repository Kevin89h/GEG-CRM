"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Plus, TrendingUp, LayoutGrid, List } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { getCompanyClientBrowser } from "@/lib/supabase/company-client-browser"
import { formatCurrency } from "@/lib/utils"
import type { Deal, DealStage } from "@/types"

type DealWithAccount = Deal & { account: { id: string; name: string } | null }

interface Props {
  deals: DealWithAccount[]
  accounts: { id: string; name: string }[]
  profiles: { id: string; full_name: string | null; email: string }[]
  currentUserId: string
}

const STAGES: DealStage[] = ["lead", "qualified", "proposal", "negotiation", "won", "lost"]

const stageColors: Record<DealStage, "gray" | "blue" | "yellow" | "purple" | "green" | "red"> = {
  lead: "gray",
  qualified: "blue",
  proposal: "yellow",
  negotiation: "purple",
  won: "green",
  lost: "red",
}

export default function DealsClient({ deals: initial, accounts, profiles, currentUserId }: Props) {
  const t = useTranslations("deals")
  const [deals, setDeals] = useState(initial)
  const [view, setView] = useState<"kanban" | "list">("kanban")
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: "", account_id: accounts[0]?.id ?? "", stage: "lead" as DealStage,
    value: "", currency: "GNF" as "USD" | "GNF" | "EUR",
    probability: "20", close_date: "", owner_id: currentUserId, notes: "",
  })

  async function handleSave() {
    setSaving(true)
    const { supabase, db } = getCompanyClientBrowser()
    const { data, error } = await supabase
      .from("deals")
      .insert([{
        ...form,
        value: form.value ? parseFloat(form.value) : null,
        probability: form.probability ? parseInt(form.probability) : null,
      }])
      .select("*, account:accounts(id, name)")
      .single()
    if (!error && data) {
      setDeals(prev => [data, ...prev])
      setModalOpen(false)
      setForm({ title: "", account_id: accounts[0]?.id ?? "", stage: "lead", value: "", currency: "GNF", probability: "20", close_date: "", owner_id: currentUserId, notes: "" })
    }
    setSaving(false)
  }

  async function updateStage(dealId: string, newStage: DealStage) {
    const { supabase, db } = getCompanyClientBrowser()
    await db.from("deals").update({ stage: newStage }).eq("id", dealId)
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage } : d))
  }

  const totalPipeline = deals
    .filter(d => !["won", "lost"].includes(d.stage))
    .reduce((sum, d) => sum + (d.value ?? 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Pipeline: {formatCurrency(totalPipeline, "USD")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 transition ${view === "kanban" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <LayoutGrid className="w-4 h-4" />
              {t("kanban")}
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 transition ${view === "list" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <List className="w-4 h-4" />
              {t("list")}
            </button>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            {t("new")}
          </Button>
        </div>
      </div>

      {/* Kanban view */}
      {view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage)
            const stageValue = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0)
            return (
              <div key={stage} className="flex-shrink-0 w-64">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={stageColors[stage]}>{t(stage)}</Badge>
                    <span className="text-xs text-gray-400 font-medium">{stageDeals.length}</span>
                  </div>
                  {stageValue > 0 && (
                    <span className="text-xs text-gray-500">{formatCurrency(stageValue, "USD")}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {stageDeals.map(deal => (
                    <div key={deal.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 hover:shadow-md transition-shadow">
                      <p className="font-medium text-gray-900 text-sm leading-tight">{deal.title}</p>
                      {deal.account && (
                        <p className="text-xs text-gray-500 mt-1">{deal.account.name}</p>
                      )}
                      {deal.value && (
                        <p className="text-sm font-semibold text-blue-600 mt-2">
                          {formatCurrency(deal.value, deal.currency)}
                        </p>
                      )}
                      {deal.probability != null && (
                        <div className="mt-2">
                          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${deal.probability}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{deal.probability}%</p>
                        </div>
                      )}
                      {/* Quick stage move */}
                      <select
                        value={deal.stage}
                        onChange={e => updateStage(deal.id, e.target.value as DealStage)}
                        onClick={e => e.stopPropagation()}
                        className="mt-2 w-full text-xs border border-gray-100 rounded-md px-2 py-1 bg-gray-50 text-gray-600 focus:outline-none"
                      >
                        {STAGES.map(s => <option key={s} value={s}>{t(s)}</option>)}
                      </select>
                    </div>
                  ))}
                  {stageDeals.length === 0 && (
                    <div className="border-2 border-dashed border-gray-100 rounded-xl p-4 text-center text-xs text-gray-300">
                      —
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List view */
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {deals.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>{t("noDeals")}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Titre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t("account")}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t("stage")}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t("value")}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t("probability")}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t("closeDate")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {deals.map(deal => (
                  <tr key={deal.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{deal.title}</td>
                    <td className="px-4 py-3 text-gray-600">{deal.account?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={stageColors[deal.stage]}>{t(deal.stage)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {deal.value ? formatCurrency(deal.value, deal.currency) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {deal.probability != null ? `${deal.probability}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {deal.close_date ? new Date(deal.close_date).toLocaleDateString("fr") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* New Deal Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("newDeal")}>
        <div className="space-y-4">
          <Input
            label="Titre de l'opportunité"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />
          <Select
            label={t("account")}
            value={form.account_id}
            onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
            options={accounts.map(a => ({ value: a.id, label: a.name }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t("stage")}
              value={form.stage}
              onChange={e => setForm(f => ({ ...f, stage: e.target.value as DealStage }))}
              options={STAGES.map(s => ({ value: s, label: t(s) }))}
            />
            <Select
              label={t("currency")}
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value as "USD" | "GNF" | "EUR" }))}
              options={[
                { value: "GNF", label: "GNF" },
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("value")}
              type="number"
              value={form.value}
              onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
            />
            <Input
              label={`${t("probability")} (%)`}
              type="number"
              min="0"
              max="100"
              value={form.probability}
              onChange={e => setForm(f => ({ ...f, probability: e.target.value }))}
            />
          </div>
          <Input
            label={t("closeDate")}
            type="date"
            value={form.close_date}
            onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.account_id || saving}>{t("save")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
