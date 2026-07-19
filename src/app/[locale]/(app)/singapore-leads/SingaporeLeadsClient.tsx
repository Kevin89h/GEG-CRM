"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Globe, Trash2, ArrowLeftRight, MapPin, Mail } from "lucide-react"

interface Lead {
  id: string
  title: string
  status: string
  notes: string | null
  created_at: string
  account_name: string
  account_email: string
  account_country: string | null
}

interface Props {
  leads: Lead[]
}

export default function SingaporeLeadsClient({ leads: initial }: Props) {
  const router = useRouter()
  const [leads, setLeads] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce lead définitivement ?")) return
    setLoading(id + "-delete")
    const res = await fetch(`/api/singapore-leads/${id}`, { method: "DELETE" })
    if (res.ok) {
      setLeads(prev => prev.filter(l => l.id !== id))
    } else {
      const { error } = await res.json()
      alert("Erreur : " + error)
    }
    setLoading(null)
  }

  async function handleTransfer(id: string) {
    if (!confirm("Transférer ce lead vers GEG Guinée ?")) return
    setLoading(id + "-transfer")
    const res = await fetch(`/api/singapore-leads/${id}`, { method: "POST" })
    if (res.ok) {
      setLeads(prev => prev.filter(l => l.id !== id))
      router.refresh()
    } else {
      const { error } = await res.json()
      alert("Erreur : " + error)
    }
    setLoading(null)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Globe className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leads Singapore</h1>
          <p className="text-sm text-gray-500">{leads.length} lead{leads.length !== 1 ? "s" : ""} internationaux</p>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucun lead Singapore pour l&apos;instant</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <div key={lead.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 truncate">{lead.account_name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{lead.status}</span>
                </div>
                <p className="text-sm text-gray-500 truncate mb-1">{lead.title}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  {lead.account_email && (
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.account_email}</span>
                  )}
                  {lead.account_country && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.account_country}</span>
                  )}
                  <span>{formatDate(lead.created_at)}</span>
                </div>
                {lead.notes && (
                  <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{lead.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleTransfer(lead.id)}
                  disabled={loading !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition disabled:opacity-50"
                  title="Transférer vers GEG Guinée"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  {loading === lead.id + "-transfer" ? "..." : "→ Guinée"}
                </button>
                <button
                  onClick={() => handleDelete(lead.id)}
                  disabled={loading !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition disabled:opacity-50"
                  title="Supprimer ce lead"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {loading === lead.id + "-delete" ? "..." : "Supprimer"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
