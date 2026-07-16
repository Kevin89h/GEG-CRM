"use client"

import { useState, useRef, useEffect } from "react"
import { Share2, Mail, MessageCircle, X, Loader2 } from "lucide-react"

interface Props {
  documentId: string
  number: string
  clientName: string | null | undefined
  type: "facture" | "devis"
}

export default function ShareButton({ documentId, number, clientName, type }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const label = type === "facture" ? "Facture" : "Devis"

  async function getPublicUrl(): Promise<string> {
    const res = await fetch("/api/document-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId, document_type: type }),
    })
    const data = await res.json()
    const origin = window.location.origin
    return `${origin}/pdf/${data.token}`
  }

  async function shareVia(channel: "whatsapp" | "email") {
    setLoading(true)
    try {
      const url = await getPublicUrl()
      const client = clientName ? ` — ${clientName}` : ""

      if (channel === "whatsapp") {
        const text = encodeURIComponent(
          `Bonjour,\n\nVeuillez trouver ci-dessous votre ${label.toLowerCase()} ${number}${client}.\n\nLien PDF : ${url}\n\nCordialement,\nGEG Guinée`
        )
        window.open(`https://wa.me/?text=${text}`, "_blank")
      } else {
        const subject = encodeURIComponent(`${label} ${number}${client}`)
        const body = encodeURIComponent(
          `Bonjour,\n\nVeuillez trouver ci-dessous votre ${label.toLowerCase()} ${number}.\n\nLien PDF : ${url}\n\nCordialement,\nGEG Guinée`
        )
        window.location.href = `mailto:?subject=${subject}&body=${body}`
      }
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Share2 className="w-4 h-4" />
        Transférer
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Envoyer via</p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <button
                onClick={() => shareVia("whatsapp")}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                  <p className="text-xs text-gray-500">Lien direct PDF</p>
                </div>
              </button>

              <button
                onClick={() => shareVia("email")}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-50"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Email</p>
                  <p className="text-xs text-gray-500">Ouvre votre messagerie</p>
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
