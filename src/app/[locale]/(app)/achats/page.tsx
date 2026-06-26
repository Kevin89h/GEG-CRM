import { createCompanyClient } from "@/lib/company"
import Link from "next/link"
import { Plus, ShoppingBag, Clock, CheckCircle2, XCircle } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"

export default async function AchatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db: supabase } = await createCompanyClient()

  const { data: orders } = await supabase
    .from("purchase_orders")
    .select(`
      id, number, supplier_name, status, currency, order_date, expected_date,
      lines:purchase_order_lines(quantity, unit_price, discount)
    `)
    .order("created_at", { ascending: false })

  const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    draft:    { label: "En attente", color: "bg-amber-100 text-amber-700",   icon: Clock },
    received: { label: "Réceptionné", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    cancelled:{ label: "Annulé",    color: "bg-red-100 text-red-600",       icon: XCircle },
  }

  type OrderRow = Record<string, unknown> & { total: number }
  const list: OrderRow[] = (orders ?? []).map((o: Record<string, unknown>) => {
    const lines = (Array.isArray(o.lines) ? o.lines : []) as { quantity: number; unit_price: number; discount: number }[]
    const total = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - (l.discount ?? 0) / 100), 0)
    return { ...o, total }
  })

  const totalDraft = list.filter(o => o.status === "draft").reduce((s, o) => s + o.total, 0)
  const totalReceived = list.filter(o => o.status === "received").length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Achats fournisseurs</h1>
          <p className="text-gray-500 text-sm mt-0.5">Commandes et calcul du prix de revient</p>
        </div>
        <Link href={`/${locale}/achats/nouveau`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition">
          <Plus className="w-4 h-4" /> Nouvelle commande
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total commandes", value: list.length, sub: "toutes devises", icon: ShoppingBag, color: "text-blue-600 bg-blue-50" },
          { label: "En attente réception", value: list.filter(o => o.status === "draft").length, sub: totalDraft > 0 ? `~${totalDraft.toLocaleString("fr")} en transit` : "aucune", icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Réceptionnés", value: totalReceived, sub: "commandes complètes", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-600 font-medium mt-0.5">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucune commande fournisseur</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Numéro</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fournisseur</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date commande</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Arrivée prévue</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map(o => {
                const cfg = statusConfig[o.status as string] ?? statusConfig.draft
                const Icon = cfg.icon
                return (
                  <tr key={o.id as string} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/${locale}/achats/${o.id}`} className="font-mono font-medium text-blue-600 hover:underline">
                        {o.number as string}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{o.supplier_name as string}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(o.order_date as string, locale)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {o.expected_date ? formatDate(o.expected_date as string, locale) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 text-xs">
                      {o.total > 0 ? formatCurrency(o.total, o.currency as "GNF" | "USD" | "EUR") : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
