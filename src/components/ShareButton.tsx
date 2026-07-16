"use client"

import { useState, useRef, useEffect } from "react"
import { Share2, Mail, MessageCircle, X } from "lucide-react"

interface Props {
  number: string
  clientName: string | null | undefined
  pdfUrl: string
  type: "facture" | "devis"
}

export default function ShareButton({ number, clientName, pdfUrl, type }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const label = type === "facture" ? "Facture" : "Devis"
  const appUrl = typeof window !== "undefined" ? window.location.href : ""
  const fullPdfUrl = typeof window !== "undefined" ? `${window.location.origin}${pdfUrl}` : pdfUrl

  const whatsappText = encodeURIComponent(
    `Bonjour,\n\nVeuillez trouver ci-dessous votre ${label.toLowerCase()} ${number}${clientName ? ` — ${clientName}` : ""}.\n\nLien PDF : ${fullPdfUrl}\n\nCordialement,\nGEG Guinée`
  )

  const emailSubject = encodeURIComponent(`${label} ${number}${clientName ? ` — ${clientName}` : ""}`)
  const emailBody = encodeURIComponent(
    `Bonjour,\n\nVeuillez trouver ci-joint votre ${label.toLowerCase()} ${number}.\n\nLien PDF : ${fullPdfUrl}\n\nCordialement,\nGEG Guinée`
  )

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

          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">WhatsApp</p>
              <p className="text-xs text-gray-500">Lien PDF + message</p>
            </div>
          </a>

          <a
            href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-t border-gray-50"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Email</p>
              <p className="text-xs text-gray-500">Ouvre votre messagerie</p>
            </div>
          </a>
        </div>
      )}
    </div>
  )
}
