"use client"

import { useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, CartesianGrid,
} from "recharts"

interface PipelineItem { stage: string; label: string; value: number; count: number; color: string }
interface InvoiceItem { label: string; value: number; color: string }
interface BillingPeriod { label: string; invoiced: number; paid: number }

interface Props {
  pipeline: PipelineItem[]
  invoiceStatus: InvoiceItem[]
  billingData: { monthly: BillingPeriod[]; weekly: BillingPeriod[] }
}

function formatAmount(v: number) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} Md`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)} M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} k`
  return `${v}`
}

function formatFull(v: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(v))
}

const RADIAN = Math.PI / 180
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: Record<string, number>) {
  if (percent < 0.06) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

function BillingTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            <span className="text-gray-600">{p.name}</span>
          </span>
          <span className="font-semibold text-gray-900">{formatFull(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardCharts({ pipeline, invoiceStatus, billingData }: Props) {
  const [billingView, setBillingView] = useState<"monthly" | "weekly">("monthly")

  const activePipeline = pipeline.filter(p => p.value > 0 || p.count > 0)
  const activeInvoices = invoiceStatus.filter(i => i.value > 0)
  const currentBilling = billingData[billingView]

  const hasAnyBilling = currentBilling.some(b => b.invoiced > 0 || b.paid > 0)

  return (
    <div className="space-y-6 mb-6">
      {/* Facturation vs Encaissements — pleine largeur */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="font-semibold text-gray-900">Facturation &amp; Encaissements</h2>
            <p className="text-xs text-gray-400 mt-0.5">Toutes devises confondues</p>
          </div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button
              onClick={() => setBillingView("weekly")}
              className={`px-3 py-1.5 font-medium transition-colors ${billingView === "weekly" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Semaine
            </button>
            <button
              onClick={() => setBillingView("monthly")}
              className={`px-3 py-1.5 font-medium transition-colors ${billingView === "monthly" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Mois
            </button>
          </div>
        </div>

        {!hasAnyBilling ? (
          <div className="flex items-center justify-center h-48 text-gray-300 text-sm">Aucune donnée sur cette période</div>
        ) : (
          <>
            {/* Légende manuelle */}
            <div className="flex items-center gap-5 mb-4 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-sm inline-block bg-blue-500" /> Facturé
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-sm inline-block bg-emerald-500" /> Encaissé
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={currentBilling} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatAmount} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<BillingTooltip />} cursor={{ fill: "#f9fafb" }} />
                <Bar dataKey="invoiced" name="Facturé" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="paid" name="Encaissé" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Pipeline + Statut factures — côte à côte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Pipeline commercial</h2>
          <p className="text-xs text-gray-400 mb-4">Valeur des opportunités par étape</p>
          {activePipeline.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-300 text-sm">Aucune opportunité</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activePipeline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatAmount} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={52} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [formatFull(Number(v)), "Valeur"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f3f4f6" }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {activePipeline.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

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
    </div>
  )
}
