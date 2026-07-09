import { createCompanyClient } from "@/lib/company"
import Link from "next/link"
import { Plus, Download } from "lucide-react"
import { formatDate } from "@/lib/utils"

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  paid: "Payée",
  partial: "Partielle",
  cancelled: "Annulée",
}
const STATUS_COLOR: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  pending:   "bg-amber-100 text-amber-700",
  paid:      "bg-emerald-100 text-emerald-700",
  partial:   "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-600",
}

export default async function FacturesFournisseursPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db } = await createCompanyClient()

  const { data: invoices } = await db
    .from("supplier_invoice_totals")
    .select("id, number, supplier_name, status, currency, total_ht, total_ttc, balance, invoice_date, due_date")
    .order("invoice_date", { ascending: false })
    .limit(200)

  const list = invoices ?? []
  const totalPending = list.filter(i => i.status === "pending" || i.status === "partial").reduce((s, i) => s + Number(i.balance ?? i.total_ttc), 0)
  const totalPaid    = list.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total_ttc), 0)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factures fournisseurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez vos achats et dépenses directement</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/supplier-invoices/export"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Exporter CSV
          </a>
          <Link
            href={`/${locale}/comptabilite/factures-fournisseurs/nouveau`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouvelle facture
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total factures</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{list.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-amber-500 uppercase tracking-wide">À payer</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{totalPending.toLocaleString("fr")} <span className="text-sm font-normal text-gray-400">GNF</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-emerald-500 uppercase tracking-wide">Payées</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{totalPaid.toLocaleString("fr")} <span className="text-sm font-normal text-gray-400">GNF</span></p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {list.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">Aucune facture fournisseur</p>
            <p className="text-sm mt-1">Créez votre première facture fournisseur</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Numéro</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Fournisseur</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Échéance</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Montant dû</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/${locale}/comptabilite/factures-fournisseurs/${inv.id}`} className="font-medium text-blue-600 hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{inv.supplier_name}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.invoice_date)}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.due_date ? formatDate(inv.due_date) : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {Number(inv.balance ?? inv.total_ttc).toLocaleString("fr")} {inv.currency}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[inv.status] ?? STATUS_COLOR.draft}`}>
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
