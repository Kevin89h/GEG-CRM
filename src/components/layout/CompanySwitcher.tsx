"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react"

interface Company {
  id: string
  name: string
  schema_name: string
  country: string | null
}

interface Props {
  companies: Company[]
  currentSchema: string
}

export default function CompanySwitcher({ companies, currentSchema }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  const current = companies.find(c => c.schema_name === currentSchema) ?? companies[0]

  async function switchTo(schema: string) {
    if (schema === currentSchema) { setOpen(false); return }
    setSwitching(true)
    setOpen(false)
    await fetch("/api/company/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schema }),
    })
    router.refresh()
    setSwitching(false)
  }

  if (companies.length <= 1) {
    // Afficher juste le nom de la société sans dropdown
    return (
      <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-blue-50 border border-blue-100">
        <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="text-xs font-semibold text-blue-700 truncate">{current?.name ?? "—"}</span>
      </div>
    )
  }

  return (
    <div className="relative mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition"
      >
        <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="flex-1 text-xs font-semibold text-blue-700 truncate text-left">
          {switching ? "Changement…" : (current?.name ?? "—")}
        </span>
        {switching
          ? <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
          : <ChevronDown className={`w-3 h-3 text-blue-500 transition-transform ${open ? "rotate-180" : ""}`} />
        }
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
          {companies.map(c => (
            <button
              key={c.id}
              onClick={() => switchTo(c.schema_name)}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition text-left"
            >
              <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{c.name}</p>
                {c.country && <p className="text-xs text-gray-400 truncate">{c.country}</p>}
              </div>
              {c.schema_name === currentSchema && (
                <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
