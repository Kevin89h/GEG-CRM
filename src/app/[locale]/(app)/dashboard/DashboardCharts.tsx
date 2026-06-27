"use client"

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts"

interface PipelineItem { stage: string; label: string; value: number; count: number; color: string }
interface InvoiceItem { label: string; value: number; color: string }

interface Props {
  pipeline: PipelineItem[]
  invoiceStatus: InvoiceItem[]
}

function formatGNF(v: number) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} Md GNF`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)} M GNF`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} k GNF`
  return `${v} GNF`
}

const RADIAN = Math.PI / 180
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: Record<string, number>) {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function DashboardCharts({ pipeline, invoiceStatus }: Props) {
  const activePipeline = pipeline.filter(p => p.value > 0 || p.count > 0)
  const activeInvoices = invoiceStatus.filter(i => i.value > 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Pipeline par étape */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Pipeline commercial</h2>
        <p className="text-xs text-gray-400 mb-4">Valeur des opportunités par étape</p>
        {activePipeline.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Aucune opportunité</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={activePipeline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatGNF} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [formatGNF(Number(v)), "Valeur"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f3f4f6" }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {activePipeline.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Statut factures */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-1">État des factures</h2>
        <p className="text-xs text-gray-400 mb-4">Répartition par statut</p>
        {activeInvoices.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Aucune facture</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={activeInvoices}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                nameKey="label"
                labelLine={false}
                label={CustomLabel as unknown as boolean}
              >
                {activeInvoices.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [String(v), "Factures"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f3f4f6" }}
              />
              <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
