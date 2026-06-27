"use client"

import { useState, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

type ApiMessage = {
  role: "user" | "assistant"
  content: string
}

const SUGGESTIONS = [
  "Faire un devis pour ACFOR — 4 fûts de diesel premium 15W40 à 7M GNF",
  "Quelles sont les commandes en attente ?",
  "Montre-moi les statistiques de ventes",
  "Quelles factures sont en retard ?",
  "Cherche le client Total Guinée",
]

function parseLinks(text: string, locale: string) {
  // Convert /fr/ventes/devis/UUID → clickable link
  const parts = text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\)|\/[a-z]{2}\/[^\s]+)/g)
  return parts.map((part, i) => {
    if (part.startsWith("/") && part.includes("/")) {
      const path = `/${locale}${part.slice(3)}` // replace /fr/ with /{locale}/
      return (
        <Link key={i} href={path} className="text-violet-600 underline font-medium hover:text-violet-700">
          Ouvrir le document ↗
        </Link>
      )
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function renderMarkdown(text: string, locale: string) {
  const lines = text.split("\n")
  return lines.map((line, i) => {
    if (line.startsWith("## ")) return <h3 key={i} className="font-semibold text-gray-900 mt-3 mb-1">{line.slice(3)}</h3>
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return (
        <li key={i} className="ml-4 list-disc text-gray-700">
          {parseLinks(line.slice(2), locale)}
        </li>
      )
    }
    if (line.trim() === "") return <br key={i} />
    return <p key={i} className="text-gray-700 leading-relaxed">{parseLinks(line, locale)}</p>
  })
}

export default function AIAssistantClient() {
  const params = useParams()
  const locale = (params.locale as string) ?? "fr"
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Bonjour ! Je suis l'assistant IA de GEG Guinée. Je peux créer des devis, répondre à vos questions sur les ventes, achats, stock, et factures. Comment puis-je vous aider ?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    // Build API messages (exclude welcome)
    const apiMessages: ApiMessage[] = messages
      .filter(m => m.id !== "welcome")
      .concat(userMsg)
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      })
      const data = await res.json()
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply ?? data.error ?? "Erreur inconnue",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Erreur de connexion. Veuillez réessayer.",
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <h1 className="font-semibold text-gray-900">Assistant IA — GEG Guinée</h1>
          <p className="text-xs text-gray-500">Créez des devis, consultez vos données, posez vos questions</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-emerald-700">En ligne</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-gray-50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
              ${msg.role === "assistant"
                ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
                : "bg-gray-800 text-white"
              }`}>
              {msg.role === "assistant" ? "IA" : "V"}
            </div>

            {/* Bubble */}
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm
              ${msg.role === "assistant"
                ? "bg-white border border-gray-100 rounded-tl-sm"
                : "bg-violet-600 text-white rounded-tr-sm"
              }`}>
              {msg.role === "assistant" ? (
                <div className="text-sm space-y-1">
                  {renderMarkdown(msg.content, locale)}
                </div>
              ) : (
                <p className="text-sm text-white">{msg.content}</p>
              )}
              <p className={`text-xs mt-1.5 ${msg.role === "assistant" ? "text-gray-400" : "text-violet-200"}`}>
                {msg.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              IA
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions (only if 1 message) */}
      {messages.length === 1 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Suggestions :</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 bg-white border-t border-gray-200 flex-shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ex: Faire un devis pour ACFOR — 4 fûts 15W40 à 7M GNF..."
            rows={2}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <svg className="w-4 h-4 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Entrée pour envoyer · Shift+Entrée pour nouvelle ligne</p>
      </div>
    </div>
  )
}
