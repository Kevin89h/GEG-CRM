"use client"

import { useEffect, useState } from "react"
import { Clock, User, Plus, Edit2, Trash2, CreditCard, Send, XCircle, RotateCcw } from "lucide-react"

type LogEntry = {
  id: string
  action: string
  label: string
  user_name: string | null
  user_email: string | null
  created_at: string
}

const ACTION_ICON: Record<string, React.ElementType> = {
  create:  Plus,
  update:  Edit2,
  delete:  Trash2,
  payment: CreditCard,
  send:    Send,
  cancel:  XCircle,
  login:   User,
  export:  RotateCcw,
}

const ACTION_COLOR: Record<string, string> = {
  create:  "bg-emerald-100 text-emerald-600",
  update:  "bg-blue-100 text-blue-600",
  delete:  "bg-red-100 text-red-600",
  payment: "bg-purple-100 text-purple-600",
  send:    "bg-amber-100 text-amber-600",
  cancel:  "bg-red-100 text-red-600",
}

function formatRelative(date: string) {
  const d = new Date(date)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return "À l'instant"
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} j`
  return d.toLocaleDateString("fr", { day: "numeric", month: "short", year: "numeric" })
}

interface Props {
  resource: string
  resourceId: string
}

export default function ActivityLog({ resource, resourceId }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!resourceId) return
    fetch(`/api/activity-logs?resource=${resource}&resourceId=${resourceId}`)
      .then(r => r.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [resource, resourceId])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0" />
            <div className="flex-1 space-y-1.5 py-0.5">
              <div className="h-3 bg-gray-100 rounded w-3/4" />
              <div className="h-2.5 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-gray-400">
        <Clock className="w-6 h-6 mb-1.5 opacity-40" />
        <p className="text-xs">Aucune activité enregistrée</p>
      </div>
    )
  }

  return (
    <ol className="relative space-y-0">
      {logs.map((log, i) => {
        const Icon = ACTION_ICON[log.action] ?? Edit2
        const color = ACTION_COLOR[log.action] ?? "bg-gray-100 text-gray-500"
        const isLast = i === logs.length - 1
        return (
          <li key={log.id} className="flex gap-3 relative">
            {!isLast && (
              <div className="absolute left-3.5 top-7 bottom-0 w-px bg-gray-100" />
            )}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 pb-4 min-w-0">
              <p className="text-sm text-gray-800 leading-snug">{log.label}</p>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                <span>{log.user_name ?? log.user_email ?? "Système"}</span>
                <span>·</span>
                <span title={new Date(log.created_at).toLocaleString("fr")}>{formatRelative(log.created_at)}</span>
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
