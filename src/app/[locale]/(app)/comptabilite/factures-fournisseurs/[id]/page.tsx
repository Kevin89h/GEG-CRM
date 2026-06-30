import { createCompanyClient } from "@/lib/company"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { formatDate } from "@/lib/utils"

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon", pending: "En attente", paid: "Payée", partial: "Partielle", cancelled: "Annulée",
}
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  partial: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-600",
}

export default async function FactureFournisseurDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const { db } = await createCompanyClient()

  const { data: invoice } = await db
    .from("supplier_invoices")
    .select("*")
    .eq("id", id)
    .single()

  if (!invoice) notFound()

  const { data: lines } = await db
    .from("supplier_invoice_lines")
    .select("*")
    .eq("invoice_id", id)
    .order("position")

  const rows = lines ?? []

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href={`/${locale}/comptabilite/factures-fournisseurs`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{invoice.number}</h1>
          <p className="text-gray-500 mt-0.5">{invoice.supplier_name}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLOR[invoice.status] ?? STATUS_COLOR.pending}`}>
          {STATUS_LABEL[invoice.status] ?? invoice.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm">Informations</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{formatDate(invoice.invoice_date)}</span></div>
            {invoice.due_date && <div className="flex justify-between"><span className="text-gray-500">Échéance</span><span>{formatDate(invoice.due_date)}</span></div>}
            {invoice.reference && <div className="flex justify-between"><span className="text-gray-500">Référence</span><span>{invoice.reference}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500">Devise</span><span>{invoice.currency}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm">Montants</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total HT</span><span className="font-medium">{Number(invoice.total_ht).toLocaleString("fr")} {invoice.currency}</span></div>
            {Number(invoice.tax_amount) > 0 && <div className="flex justify-between"><span className="text-gray-500">TVA</span><span className="font-medium">{Number(invoice.tax_amount).toLocaleString("fr")} {invoice.currency}</span></div>}
            <div className="flex justify-between pt-2 border-t border-gray-100"><span className="font-semibold text-gray-900">Total TTC</span><span className="font-bold text-blue-600 text-base">{Number(invoice.total_ttc).toLocaleString("fr")} {invoice.currency}</span></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Description</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Qté</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Prix unit.</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">TVA %</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(l => {
              const total = (Number(l.quantity) * Number(l.unit_price)) * (1 + Number(l.tax_rate) / 100)
              return (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-gray-800">{l.description}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{Number(l.quantity).toLocaleString("fr")}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{Number(l.unit_price).toLocaleString("fr")}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{Number(l.tax_rate)}%</td>
                  <td className="px-4 py-3 text-right font-medium">{total.toLocaleString("fr")}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {invoice.notes && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 text-sm mb-2">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}
    </div>
  )
}
