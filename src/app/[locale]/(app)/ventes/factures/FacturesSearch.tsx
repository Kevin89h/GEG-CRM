"use client"

import { useRouter } from "next/navigation"
import { useRef, useTransition } from "react"
import { Search, X } from "lucide-react"

interface Props {
  filtre: string
  initialQ: string
  locale: string
}

export default function FacturesSearch({ filtre, initialQ, locale }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const ref = useRef<HTMLInputElement>(null)

  function go(q: string) {
    const url = `/${locale}/ventes/factures?filtre=${filtre}${q ? `&q=${encodeURIComponent(q)}` : ""}`
    startTransition(() => router.push(url))
  }

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        ref={ref}
        type="text"
        defaultValue={initialQ}
        placeholder="Rechercher par client ou numéro…"
        className="pl-9 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 text-gray-800 placeholder-gray-400"
        onChange={e => go(e.target.value)}
      />
      {initialQ && (
        <button
          onClick={() => { if (ref.current) ref.current.value = ""; go("") }}
          className="absolute right-2 text-gray-400 hover:text-gray-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
