import { createCompanyClient } from "@/lib/company"
import Link from "next/link"
import { Plus, FileText, Receipt, TrendingUp, Clock } from "lucide-react"
import { formatNumber } from "@/lib/utils"

export default async function VentesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { db: supabase } = await createCompanyClient()

  const [{ data: orders }, { data: invoices }] = await Promise.all([
    supabase
      .from("sales_orders")
      .select("id, number, status, currency, created_at, account:accounts(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("invoices")
      .select("id, number, status, currency, issue_date, due_date, account:accounts(name)")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const { data: stats } = await supabase.from("sales_order_totals").select("status, total_ht, currency")

  const draftCount = stats?.filter(s => s.status === "draft").length ?? 0
  const confirmedCount = stats?.filter(s => s.status === "confirmed").length ?? 0
  const totalPipeline = stats
    ?.filter(s => s.status !== "cancelled")
    .reduce((sum, s) => sum + Number(s.total_ht), 0) ?? 0

  const { data: invStats } = await supabase.from("invoice_totals").select("status, balance, currency")
  const unpaidByCurrency: Record<string, number> = {}
  for (const s of invStats ?? []) {
    if (s.status !== "paid" && s.status !== "cancelled" && Number(s.balance) > 0) {
      const c = s.currency ?? "GNF"
      unpaidByCurrency[c] = (unpaidByCurrency[c] ?? 0) + Number(s.balance)
    }
  }
  const unpaidLabel = Object.entries(unpaidByCurrency)
    .map(([c, v]) => `${formatNumber(v)} ${c}`)
    .join(" · ") || "0"

  const statusLabel: Record<string, string> = {
    draft: "Brouillon", confirmed: "Confirmé", invoiced: "Facturé", cancelled: "Annulé",
    sent: "Envoyée", paid: "Payée",
  }
  const statusColor: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    confirmed: "bg-blue-100 text-blue-700",
    invoiced: "bg-purple-100 text-purple-700",
    cancelled: "bg-red-100 text-red-600",
    sent: "bg-amber-100 text-amber-700",
    paid: "bg-emerald-100 text-emerald-700",
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Ventes</h1>
          <p className="text-gray-500 text-sm mt-0.5">Devis, commandes et factures</p>
        </div>
        <Link
          href={`/${locale}/ventes/devis/nouveau`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition"
        >
          <Plus className="w-4 h-4" />
          Nouveau devis
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Devis en cours", value: draftCount, icon: FileText, color: "text-gray-600 bg-gray-50" },
          { label: "Commandes confirmées", value: confirmedCount, icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
          { label: "Pipeline total", value: `${formatNumber(totalPipeline)} GNF`, icon: TrendingUp, color: "text-purple-600 bg-purple-50" },
          { label: "Factures impayées", value: unpaidLabel, icon: Clock, color: "text-amber-600 bg-amber-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Derniers devis */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" /> Derniers devis
            </h2>
            <Link href={`/${locale}/ventes/devis`} className="text-xs text-blue-600 hover:underline">Voir tout</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(orders ?? []).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Aucun devis</p>
            )}
            {(orders ?? []).map((o: Record<string, unknown>) => (
              <Link key={o.id as string} href={`/${locale}/ventes/devis/${o.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-blue-50/30 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{o.number as string}</p>
                  <p className="text-xs text-gray-500">{(o.account as { name: string } | null)?.name ?? "—"}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[o.status as string] ?? ""}`}>
                  {statusLabel[o.status as string]}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Dernières factures */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-gray-400" /> Dernières factures
            </h2>
            <Link href={`/${locale}/ventes/factures`} className="text-xs text-blue-600 hover:underline">Voir tout</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(invoices ?? []).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Aucune facture</p>
            )}
            {(invoices ?? []).map((i: Record<string, unknown>) => (
              <Link key={i.id as string} href={`/${locale}/ventes/factures/${i.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-blue-50/30 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{i.number as string}</p>
                  <p className="text-xs text-gray-500">{(i.account as { name: string } | null)?.name ?? "—"}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[i.status as string] ?? ""}`}>
                  {statusLabel[i.status as string]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
