"use client"

import { useState } from "react"
import { Search, Building2, Phone, Mail, MapPin, Users, Briefcase, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  country: string | null
  type: string | null
}

interface Props { clients: Client[] }

const TYPE_LABELS: Record<string, string> = {
  client: "Client",
  prospect: "Prospect",
  partner: "Partenaire",
  government: "Gouvernement",
  other: "Autre",
}

const TYPE_COLORS: Record<string, string> = {
  client: "bg-green-50 text-green-700",
  prospect: "bg-blue-50 text-blue-700",
  partner: "bg-purple-50 text-purple-700",
  government: "bg-amber-50 text-amber-700",
  other: "bg-gray-100 text-gray-600",
}

export default function ClientsContactsClient({ clients }: Props) {
  const [search, setSearch] = useState("")
  const params = useParams()
  const locale = params.locale as string

  const filtered = clients.filter(c =>
    `${c.name} ${c.email ?? ""} ${c.city ?? ""} ${c.country ?? ""} ${c.type ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <Link href={`/${locale}/contacts`}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 border-b-2 border-transparent hover:border-gray-300 transition-colors">
          <Users className="w-4 h-4" /> Contacts
        </Link>
        <Link href={`/${locale}/contacts/clients`}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
          <Briefcase className="w-4 h-4" /> Clients
        </Link>
        <Link href={`/${locale}/contacts/fournisseurs`}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 border-b-2 border-transparent hover:border-gray-300 transition-colors">
          <Building2 className="w-4 h-4" /> Fournisseurs
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} compte{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href={`/${locale}/comptes`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <ExternalLink className="w-4 h-4" /> Gérer les comptes
        </Link>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un client…"
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucun client{search ? " correspondant" : ""}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 font-medium bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3">Nom</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-left px-4 py-3">Localisation</th>
                <th className="text-left px-4 py-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/60 group">
                  <td className="px-4 py-3">
                    <Link href={`/${locale}/comptes/${c.id}`} className="flex items-center gap-2.5 hover:text-blue-600 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 text-xs font-bold">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="font-semibold text-gray-900 group-hover:text-blue-600">{c.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</p>}
                    {c.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {(c.city || c.country) && (
                      <p className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {[c.city, c.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.type && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLORS[c.type] ?? "bg-gray-100 text-gray-600"}`}>
                        {TYPE_LABELS[c.type] ?? c.type}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
