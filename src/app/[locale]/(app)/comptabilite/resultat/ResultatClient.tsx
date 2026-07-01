"use client"

import { useRouter } from "next/navigation"
import { Printer } from "lucide-react"

interface Invoice  { id: string; status: string; currency: string; total_ht: number; issue_date: string }
interface Purchase { id: string; status: string; currency: string; total_ht: number; invoice_date: string }
interface Tx       { id: string; type: string; amount: number; currency: string; category: string | null; description: string; date: string }

interface Props {
  locale:    string
  year:      number
  currency:  string
  invoices:  Invoice[]
  purchases: Purchase[]
  txCredits: Tx[]
  txDebits:  Tx[]
}

function fmt(n: number) {
  const parts = Math.round(Math.abs(n)).toString().split(".")
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return (n < 0 ? "(" : "") + parts[0] + (n < 0 ? ")" : "")
}

const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)
const CURRENCIES = ["GNF", "USD", "EUR"]

// Catégorisation des transactions selon OHADA
function catTx(tx: Tx[], cats: string[]) {
  return tx.filter(t => cats.includes(t.category ?? "autre")).reduce((s, t) => s + t.amount, 0)
}

export default function ResultatClient({ locale, year, currency, invoices, purchases, txCredits, txDebits }: Props) {
  const router = useRouter()

  function setFilter(key: string, val: string | number) {
    const url = new URL(window.location.href)
    url.searchParams.set(key, String(val))
    router.push(url.pathname + "?" + url.searchParams.toString())
  }

  // ── PRODUITS D'EXPLOITATION ──────────────────────────────
  const ca      = invoices.reduce((s, i) => s + Number(i.total_ht), 0)
  const autreProd = catTx(txCredits, ["subvention", "autre_produit", "produit_accessoire"])

  // ── CHARGES D'EXPLOITATION ───────────────────────────────
  const achats        = purchases.reduce((s, p) => s + Number(p.total_ht), 0)
  const personnel     = catTx(txDebits, ["salaires", "charges_sociales", "personnel"])
  const services_ext  = catTx(txDebits, ["services_ext", "loyer", "entretien", "assurance", "transport", "communication"])
  const impots_taxes  = catTx(txDebits, ["impots", "taxes", "douane"])
  const amort         = catTx(txDebits, ["amortissement", "dotation"])
  const autres_charges = catTx(txDebits, ["autres", "autre", "divers"])
    + txDebits.filter(t => ![
        "salaires","charges_sociales","personnel",
        "services_ext","loyer","entretien","assurance","transport","communication",
        "impots","taxes","douane",
        "amortissement","dotation",
        "charges_financieres","interets","perte_change",
        "hao","cession",
        "participation","impot_benefice",
      ].includes(t.category ?? "")).reduce((s, t) => s + t.amount, 0)

  // ── RÉSULTAT D'EXPLOITATION ──────────────────────────────
  const totalProdExpl  = ca + autreProd
  const totalCharExpl  = achats + personnel + services_ext + impots_taxes + amort + autres_charges
  const resultatExpl   = totalProdExpl - totalCharExpl

  // ── FINANCIER ─────────────────────────────────────────────
  const prodFin  = catTx(txCredits, ["interets_recus", "gain_change", "produit_financier"])
  const charFin  = catTx(txDebits,  ["charges_financieres", "interets", "perte_change"])
  const resFin   = prodFin - charFin

  // ── RAO (Résultat Activités Ordinaires) ───────────────────
  const rao = resultatExpl + resFin

  // ── HAO ──────────────────────────────────────────────────
  const prodHAO  = catTx(txCredits, ["hao", "cession"])
  const charHAO  = catTx(txDebits,  ["hao", "cession"])
  const resHAO   = prodHAO - charHAO

  // ── RÉSULTAT NET ─────────────────────────────────────────
  const participation   = catTx(txDebits, ["participation"])
  const impotBenefice   = catTx(txDebits, ["impot_benefice"])
  const resultatNet     = rao + resHAO - participation - impotBenefice

  const cur = currency === "GNF" ? "FG" : currency

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between no-print">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Compte de résultat</h1>
          <p className="text-sm text-gray-500 mt-0.5">Norme OHADA — Système normal</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={e => setFilter("year", e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white"
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={currency}
            onChange={e => setFilter("currency", e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Printer className="w-4 h-4" /> Imprimer
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* En-tête document */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Compte de Résultat</h2>
          <p className="text-gray-600 mt-1">Exercice du 1er janvier {year} au 31 décembre {year}</p>
          <p className="text-gray-500 text-sm mt-0.5">Plan comptable OHADA — Système normal · Montants en {currency}</p>
        </div>

        {/* Tableau OHADA */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="text-left px-5 py-3 font-semibold w-16">Réf.</th>
                <th className="text-left px-3 py-3 font-semibold">Libellé</th>
                <th className="text-right px-5 py-3 font-semibold w-40">Note</th>
                <th className="text-right px-5 py-3 font-semibold w-44">Exercice {year} ({cur})</th>
              </tr>
            </thead>
            <tbody>
              {/* ─── PRODUITS D'EXPLOITATION ─── */}
              <SectionHeader label="PRODUITS D'EXPLOITATION" />
              <Row code="TA" label="Ventes de marchandises" value={ca} positive highlight={false} />
              <Row code="TB" label="Travaux, services vendus" value={0} positive />
              <Row code="TC" label="Production vendue — Biens" value={0} positive />
              <Row code="TD" label="Production vendue — Services" value={0} positive />
              <SectionTotal label="Chiffre d'affaires (CA) = TA+TB+TC+TD" value={ca} positive bold />
              <Row code="TE" label="Variation de stocks produits finis et encours" value={0} positive />
              <Row code="TF" label="Production immobilisée" value={0} positive />
              <Row code="TG" label="Subventions d'exploitation" value={0} positive />
              <Row code="TH" label="Autres produits" value={autreProd} positive />
              <Row code="TI" label="Transferts de charges d'exploitation" value={0} positive />
              <Row code="TJ" label="Reprises de provisions et amortissements" value={0} positive />
              <SectionTotal label="Total produits d'exploitation (I)" value={totalProdExpl} positive bold />

              {/* ─── CHARGES D'EXPLOITATION ─── */}
              <SectionHeader label="CHARGES D'EXPLOITATION" />
              <Row code="HA" label="Achats de marchandises vendues" value={achats} positive={false} />
              <Row code="HB" label="Variation de stocks de marchandises" value={0} positive={false} />
              <Row code="HC" label="Achats de matières premières et fournitures liées" value={0} positive={false} />
              <Row code="HD" label="Variation de stocks de matières premières" value={0} positive={false} />
              <Row code="HE" label="Autres achats" value={0} positive={false} />
              <Row code="HF" label="Variation de stocks d'autres approvisionnements" value={0} positive={false} />
              <Row code="HG" label="Transports" value={0} positive={false} />
              <Row code="HH" label="Services extérieurs" value={services_ext} positive={false} />
              <Row code="HI" label="Impôts et taxes" value={impots_taxes} positive={false} />
              <Row code="HJ" label="Autres charges" value={autres_charges} positive={false} />
              <Row code="HK" label="Charges de personnel" value={personnel} positive={false} />
              <Row code="HL" label="Dotations aux amortissements et provisions" value={amort} positive={false} />
              <SectionTotal label="Total charges d'exploitation (II)" value={totalCharExpl} positive={false} bold />

              {/* ─── RÉSULTAT D'EXPLOITATION ─── */}
              <ResultatRow code="RE" label="RÉSULTAT D'EXPLOITATION (I − II)" value={resultatExpl} />

              {/* ─── FINANCIER ─── */}
              <SectionHeader label="PRODUITS FINANCIERS" />
              <Row code="TK" label="Revenus financiers" value={prodFin} positive />
              <Row code="TL" label="Gains de change" value={0} positive />
              <Row code="TM" label="Reprises de provisions et amortissements financiers" value={0} positive />
              <Row code="TN" label="Transferts de charges financières" value={0} positive />
              <SectionTotal label="Total produits financiers (III)" value={prodFin} positive bold />

              <SectionHeader label="CHARGES FINANCIÈRES" />
              <Row code="HM" label="Frais financiers et charges assimilées" value={charFin} positive={false} />
              <Row code="HN" label="Pertes de change" value={0} positive={false} />
              <Row code="HO" label="Dotations aux provisions et amortissements financiers" value={0} positive={false} />
              <SectionTotal label="Total charges financières (IV)" value={charFin} positive={false} bold />

              <ResultatRow code="RF" label="RÉSULTAT FINANCIER (III − IV)" value={resFin} />
              <ResultatRow code="RAO" label="RÉSULTAT DES ACTIVITÉS ORDINAIRES (RE + RF)" value={rao} accent />

              {/* ─── HAO ─── */}
              <SectionHeader label="PRODUITS HAO (Hors Activités Ordinaires)" />
              <Row code="TO" label="Produits des cessions d'immobilisations" value={prodHAO} positive />
              <Row code="TP" label="Produits HAO divers" value={0} positive />
              <Row code="TQ" label="Reprises de provisions HAO" value={0} positive />
              <SectionTotal label="Total produits HAO (V)" value={prodHAO} positive bold />

              <SectionHeader label="CHARGES HAO" />
              <Row code="HP" label="Valeurs comptables cessions d'immobilisations" value={charHAO} positive={false} />
              <Row code="HQ" label="Charges HAO diverses" value={0} positive={false} />
              <Row code="HR" label="Dotations aux provisions HAO" value={0} positive={false} />
              <SectionTotal label="Total charges HAO (VI)" value={charHAO} positive={false} bold />

              <ResultatRow code="RHAO" label="RÉSULTAT HAO (V − VI)" value={resHAO} />

              {/* ─── RÉSULTAT NET ─── */}
              <SectionHeader label="RÉSULTAT NET" />
              <Row code="HS" label="Participation des travailleurs" value={participation} positive={false} />
              <Row code="HT" label="Impôts sur le résultat" value={impotBenefice} positive={false} />
              <ResultatRow code="RN" label="RÉSULTAT NET (RAO + RHAO − HS − HT)" value={resultatNet} accent large />
            </tbody>
          </table>
        </div>

        {/* Note explicative */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 no-print">
          <p className="font-semibold mb-1">Note sur les données</p>
          <p>Le chiffre d'affaires est calculé à partir des factures clients émises (hors brouillons et annulées).
          Les achats proviennent des factures fournisseurs. Les autres charges et produits sont issus des mouvements
          de trésorerie selon leur catégorie. Pour affiner la classification, attribuez des catégories aux
          transactions dans le module Trésorerie.</p>
        </div>

        {/* Signature */}
        <div className="mt-10 grid grid-cols-2 gap-16 print-only" style={{ display: "none" }}>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-8">Le Directeur Financier</p>
            <div className="border-t border-gray-400 pt-2 text-sm text-gray-500">Signature et cachet</div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-8">Le Directeur Général</p>
            <div className="border-t border-gray-400 pt-2 text-sm text-gray-500">Signature et cachet</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: grid !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-slate-100">
      <td colSpan={4} className="px-5 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
        {label}
      </td>
    </tr>
  )
}

function Row({
  code, label, value, positive, highlight = true,
}: {
  code: string; label: string; value: number; positive: boolean; highlight?: boolean
}) {
  const colorVal = value === 0 ? "text-gray-400" : positive ? "text-emerald-700" : "text-red-700"
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-5 py-2.5 text-xs font-mono font-semibold text-slate-500">{code}</td>
      <td className="px-3 py-2.5 text-gray-800">{label}</td>
      <td className="px-5 py-2.5 text-right text-gray-400 text-xs">—</td>
      <td className={`px-5 py-2.5 text-right font-mono font-semibold ${colorVal}`}>
        {value === 0 ? "—" : fmt(value)}
      </td>
    </tr>
  )
}

function SectionTotal({ label, value, positive, bold }: { label: string; value: number; positive: boolean; bold?: boolean }) {
  const colorVal = value === 0 ? "text-gray-500" : positive ? "text-emerald-800" : "text-red-800"
  return (
    <tr className="bg-slate-50 border-y border-slate-200">
      <td className="px-5 py-2.5 text-xs font-mono text-slate-500" />
      <td className={`px-3 py-2.5 text-sm text-slate-800 ${bold ? "font-bold" : "font-semibold"}`}>{label}</td>
      <td className="px-5 py-2.5 text-right text-gray-400 text-xs">—</td>
      <td className={`px-5 py-2.5 text-right font-mono text-sm font-bold ${colorVal}`}>
        {fmt(value)}
      </td>
    </tr>
  )
}

function ResultatRow({ code, label, value, accent, large }: { code: string; label: string; value: number; accent?: boolean; large?: boolean }) {
  const bg = accent ? "bg-slate-800" : "bg-slate-700"
  const textColor = value >= 0 ? "text-emerald-400" : "text-red-400"
  return (
    <tr className={`${bg} border-y-2 border-slate-600`}>
      <td className={`px-5 py-3 font-mono font-bold text-white text-xs`}>{code}</td>
      <td className={`px-3 py-3 font-bold text-white ${large ? "text-base" : "text-sm"}`}>{label}</td>
      <td className="px-5 py-3 text-right text-slate-400 text-xs">—</td>
      <td className={`px-5 py-3 text-right font-mono font-bold ${large ? "text-lg" : "text-sm"} ${textColor}`}>
        {fmt(value)}
      </td>
    </tr>
  )
}
