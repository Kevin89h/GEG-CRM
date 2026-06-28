import { createCompanyClient } from "@/lib/company"
import Link from "next/link"
import { formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/Badge"
import { getLocale } from "next-intl/server"

const statusColors: Record<string, "gray" | "blue" | "green" | "red"> = {
  draft: "gray",
  confirmed: "blue",
  delivered: "green",
  cancelled: "red",
}

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  confirmed: "Confirmé",
  delivered: "Livré",
  cancelled: "Annulé",
}

export default async function BonsLivraisonPage() {
  const { db } = await createCompanyClient()
  const locale = await getLocale()

  const [{ data: bons }, { data: accounts }] = await Promise.all([
    db.from("delivery_notes")
      .select("id, number, status, invoice_id, account_id, delivery_date, created_at")
      .order("created_at", { ascending: false }),
    db.from("accounts").select("id, name"),
  ])

  const accountMap: Record<string, string> = {}
  for (const a of accounts ?? []) accountMap[a.id] = a.name

  const list = (bons ?? []).map(b => ({
    ...b,
    client_name: b.account_id ? (accountMap[b.account_id] ?? "—") : "—",
  }))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bons de livraison</h1>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          Aucun bon de livraison
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Numéro</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date livraison</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Créé le</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map(b => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/ventes/bons-livraison/${b.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {b.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{b.client_name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {b.delivery_date ? formatDate(b.delivery_date) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(b.created_at)}</td>
                  <td className="px-4 py-3">
                    <Badge color={statusColors[b.status] ?? "gray"}>
                      {statusLabels[b.status] ?? b.status}
                    </Badge>
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
