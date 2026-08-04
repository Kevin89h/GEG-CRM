"use client"

import { useEffect, useState, useCallback } from "react"
import { ArrowLeft, GitMerge, Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"
import { useRouter } from "next/navigation"

interface AccountEntry {
  id: string
  name: string
  type: string
  phone: string | null
  email: string | null
  city: string | null
  country: string | null
  invoices: number
  orders: number
  contacts: number
  deals: number
}

interface DuplicateGroup {
  key: string
  accounts: AccountEntry[]
}

interface Props {
  locale: string
}

export default function DoublonsClient({ locale }: Props) {
  const router = useRouter()
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/accounts/duplicates")
    const data = await res.json()
    setGroups(data.groups ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const canAutoMerge = (group: DuplicateGroup) => {
    // Safe to auto-merge if at most one account has invoices/orders
    const withDocs = group.accounts.filter(a => a.invoices > 0 || a.orders > 0)
    return withDocs.length <= 1
  }

  const pickKeeper = (group: DuplicateGroup): AccountEntry => {
    // Keep the one with most documents; tie-break: most contacts/deals
    return group.accounts.reduce((best, a) => {
      const scoreA = a.invoices * 10 + a.orders * 10 + a.contacts + a.deals
      const scoreBest = best.invoices * 10 + best.orders * 10 + best.contacts + best.deals
      return scoreA >= scoreBest ? a : best
    })
  }

  const merge = async (keepId: string, deleteId: string, groupKey: string) => {
    setMerging(groupKey)
    const res = await fetch("/api/accounts/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keepId, deleteId }),
    })
    if (res.ok) {
      setDone(prev => new Set([...prev, groupKey]))
      setGroups(prev => prev.filter(g => g.key !== groupKey))
    } else {
      const d = await res.json()
      setErrors(prev => ({ ...prev, [groupKey]: d.error ?? "Erreur inconnue" }))
    }
    setMerging(null)
  }

  const autoMergeAll = async () => {
    const safe = groups.filter(canAutoMerge)
    for (const group of safe) {
      const keeper = pickKeeper(group)
      const toDelete = group.accounts.filter(a => a.id !== keeper.id)
      for (const del of toDelete) {
        await merge(keeper.id, del.id, group.key)
      }
    }
  }

  const toggleExpand = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const safeGroups = groups.filter(canAutoMerge)
  const manualGroups = groups.filter(g => !canAutoMerge(g))

  const total = (a: AccountEntry) => a.invoices + a.orders + a.contacts + a.deals

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/${locale}/comptes`)} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">Fusion des doublons</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analyse en cours…
        </div>
      ) : groups.length === 0 && done.size === 0 ? (
        <div className="flex items-center gap-2 text-green-600 font-medium">
          <CheckCircle2 className="w-5 h-5" />
          Aucun doublon détecté.
        </div>
      ) : (
        <div className="space-y-8">

          {/* Auto-merge section */}
          {safeGroups.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-medium text-gray-900">
                    Fusion automatique possible — {safeGroups.length} groupe{safeGroups.length > 1 ? "s" : ""}
                  </h2>
                  <p className="text-sm text-gray-500">Ces doublons n&apos;ont pas de documents conflictuels. Le compte avec le plus de données sera conservé.</p>
                </div>
                <button
                  onClick={autoMergeAll}
                  disabled={!!merging}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                  Tout fusionner ({safeGroups.length})
                </button>
              </div>

              <div className="space-y-2">
                {safeGroups.map(group => {
                  const keeper = pickKeeper(group)
                  const toDelete = group.accounts.filter(a => a.id !== keeper.id)
                  const open = expanded.has(group.key)

                  return (
                    <div key={group.key} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-white">
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggleExpand(group.key)} className="text-gray-400 hover:text-gray-600">
                            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <div>
                            <span className="font-medium text-gray-900">{keeper.name}</span>
                            <span className="ml-2 text-sm text-gray-400">
                              {group.accounts.length} comptes
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {errors[group.key] && (
                            <span className="text-xs text-red-600">{errors[group.key]}</span>
                          )}
                          {toDelete.map(del => (
                            <button
                              key={del.id}
                              onClick={() => merge(keeper.id, del.id, group.key)}
                              disabled={merging === group.key}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                            >
                              {merging === group.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitMerge className="w-3 h-3" />}
                              Fusionner
                            </button>
                          ))}
                        </div>
                      </div>

                      {open && (
                        <div className="border-t border-gray-100 divide-y divide-gray-50">
                          {group.accounts.map(a => (
                            <div key={a.id} className={`flex items-center justify-between px-4 py-2.5 text-sm ${a.id === keeper.id ? "bg-blue-50" : "bg-white"}`}>
                              <div className="flex items-center gap-2">
                                {a.id === keeper.id && <span className="text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">conservé</span>}
                                <span className="text-gray-700">{a.name}</span>
                                {a.city && <span className="text-gray-400">{a.city}</span>}
                                {a.phone && <span className="text-gray-400">{a.phone}</span>}
                              </div>
                              <div className="flex gap-3 text-gray-400 text-xs">
                                {a.invoices > 0 && <span>{a.invoices} fact.</span>}
                                {a.orders > 0 && <span>{a.orders} devis</span>}
                                {a.contacts > 0 && <span>{a.contacts} contacts</span>}
                                {a.deals > 0 && <span>{a.deals} opport.</span>}
                                {total(a) === 0 && <span className="text-gray-300">vide</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Manual section */}
          {manualGroups.length > 0 && (
            <section>
              <div className="mb-3">
                <h2 className="font-medium text-gray-900">
                  Fusion manuelle requise — {manualGroups.length} groupe{manualGroups.length > 1 ? "s" : ""}
                </h2>
                <p className="text-sm text-gray-500">Plusieurs comptes ont des factures. Choisis lequel conserver.</p>
              </div>

              <div className="space-y-3">
                {manualGroups.map(group => (
                  <div key={group.key} className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-100">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="font-medium text-gray-900">{group.accounts[0]?.name}</span>
                      <span className="text-sm text-gray-400">{group.accounts.length} comptes</span>
                    </div>
                    <div className="divide-y divide-amber-100">
                      {group.accounts.map(keeper => (
                        <div key={keeper.id} className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-gray-800">{keeper.name}</span>
                              {keeper.city && <span className="text-sm text-gray-400 ml-2">{keeper.city}</span>}
                              <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                                {keeper.invoices > 0 && <span>{keeper.invoices} factures</span>}
                                {keeper.orders > 0 && <span>{keeper.orders} devis</span>}
                                {keeper.contacts > 0 && <span>{keeper.contacts} contacts</span>}
                                {keeper.deals > 0 && <span>{keeper.deals} opportunités</span>}
                                {total(keeper) === 0 && <span>vide</span>}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {group.accounts.filter(a => a.id !== keeper.id).map(del => (
                                <button
                                  key={del.id}
                                  onClick={() => merge(keeper.id, del.id, group.key + del.id)}
                                  disabled={!!merging}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 disabled:opacity-50"
                                >
                                  {merging === group.key + del.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitMerge className="w-3 h-3" />}
                                  Conserver celui-ci
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {done.size > 0 && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              {done.size} groupe{done.size > 1 ? "s fusionnés" : " fusionné"} avec succès.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
