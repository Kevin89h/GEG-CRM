import { createCompanyClient } from "@/lib/company"
import Link from "next/link"
import { Plus, FileText } from "lucide-react"
import { formatDate, formatCurrency, formatNumber } from "@/lib/utils"

export default async function DevisListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db: supabase } = await createCompanyClient()

  const { data: orders } = await supabase
    .from("sales_order_totals")
    .select("id, number, status, currency, account_id, created_at, total_ht, salesperson_id")
    .order("created_at", { ascending: false })

  const [{ data: accounts }, { data: employees }] = await Promise.all([
    supabase.from("accounts").select("id, name"),
    supabase.from("employees").select("id, full_name"),
  ])

  const accountMap: Record<string, string> = {}
  for (const a of accounts ?? []) accountMap[a.id] = a.name
  const employeeMap: Record<string, string> = {}
  for (const e of employees ?? []) employeeMap[e.id] = e.full_name

  const statusLabel: Record<string, string> = {
    draft: "Devis", confirmed: "Bon de commande", invoiced: "Facturé", cancelled: "Annulé",
  }
  const statusColor: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    confirmed: "bg-blue-100 text-blue-700",
    invoiced: "bg-purple-100 text-purple-700",
    cancelled: "bg-red-100 text-red-600",
  }

  const list = orders ?? []
  const confirmedTotal = list
    .filter(o => o.status === "confirmed" || o.status === "invoiced")
    .reduce((s, o) => s + Number(o.total_ht), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devis / Commandes</h1>
          <p className="text-gray-500 text-sm mt-0.5">{list.length} enregistrement{list.length !== 1 ? "s" : ""} · {list.filter(o => o.status === "confirmed").length} bon{list.filter(o => o.status === "confirmed").length !== 1 ? "s" : ""} de commande</p>
        </div>
        <div className="flex items-center gap-3">
          {confirmedTotal > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-right">
              <p className="text-xs text-emerald-600 font-medium">Pipeline confirmé</p>
              <p className="text-sm font-bold text-emerald-700">{formatNumber(confirmedTotal)} USD</p>
            </div>
          )}
          <Link href={`/${locale}/ventes/devis/nouveau`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition">
            <Plus className="w-4 h-4" /> Nouveau devis
          </Link>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucun devis</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                <th className="text-left px-4 py-3 font-medium text-gray-600">N°</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vendeur</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map((o: Record<string, unknown>) => (
                <tr key={o.id as string} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/${locale}/ventes/devis/${o.id}`} className="font-mono font-medium text-blue-600 hover:underline">
                      {(o.number as string) || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{accountMap[o.account_id as string] ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{o.salesperson_id ? (employeeMap[o.salesperson_id as string] ?? "—") : "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(o.created_at as string, locale)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[o.status as string] ?? ""}`}>
                      {statusLabel[o.status as string] ?? o.status as string}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 text-xs">
                    {formatCurrency(Number(o.total_ht), o.currency as "GNF" | "USD" | "EUR")}
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
