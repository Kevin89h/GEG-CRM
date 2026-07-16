"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageSquare, X, ArrowLeft, Send, Hash, AtSign } from "lucide-react"

interface Room { id: string; type: string; name: string; reference_id?: string | null }
interface Message { id: string; user_id: string; user_name: string; content: string; created_at: string }
interface UserHint { id: string; full_name: string | null; email: string }

interface Props {
  currentUserId: string
  currentUserName: string
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 1) return "Hier"
  return d.toLocaleDateString("fr", { day: "numeric", month: "short" })
}

// Parse @mentions and highlight them
function renderContent(content: string) {
  const parts = content.split(/(@[\w.'-]+)/g)
  return parts.map((part, i) =>
    part.startsWith("@")
      ? <span key={i} className="bg-blue-100 text-blue-700 rounded px-0.5 font-medium">{part}</span>
      : <span key={i}>{part}</span>
  )
}

export default function ChatWidget({ currentUserId, currentUserName }: Props) {
  const [open, setOpen] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [activeRoom, setActiveRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [users, setUsers] = useState<UserHint[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionCursor, setMentionCursor] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalUnread = Object.values(unread).reduce((s, n) => s + n, 0)

  const fetchRooms = useCallback(async () => {
    const res = await fetch("/api/chat?action=rooms")
    if (!res.ok) return
    const json = await res.json()
    setRooms(json.rooms ?? [])
    setUnread(json.unreadCounts ?? {})
  }, [])

  const fetchMessages = useCallback(async (roomId: string) => {
    const res = await fetch(`/api/chat?action=messages&room_id=${roomId}`)
    if (!res.ok) return
    const json = await res.json()
    setMessages(json.messages ?? [])
  }, [])

  const markRead = useCallback(async (roomId: string) => {
    await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_read", room_id: roomId }) })
    setUnread(prev => ({ ...prev, [roomId]: 0 }))
  }, [])

  // Load rooms on open
  useEffect(() => {
    if (open) fetchRooms()
  }, [open, fetchRooms])

  // Load users once
  useEffect(() => {
    fetch("/api/chat?action=users").then(r => r.json()).then(j => setUsers(j.users ?? []))
  }, [])

  // Poll messages when a room is active
  useEffect(() => {
    if (!activeRoom) return
    fetchMessages(activeRoom.id)
    markRead(activeRoom.id)
    pollRef.current = setInterval(() => {
      fetchMessages(activeRoom.id)
    }, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeRoom, fetchMessages, markRead])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Poll unread counts when panel closed
  useEffect(() => {
    if (open) return
    const id = setInterval(fetchRooms, 10000)
    fetchRooms()
    return () => clearInterval(id)
  }, [open, fetchRooms])

  async function sendMessage() {
    if (!input.trim() || !activeRoom || sending) return
    setSending(true)
    const content = input.trim()
    setInput("")
    setMentionQuery(null)

    // Optimistic update
    const optimistic: Message = {
      id: `tmp-${Date.now()}`, user_id: currentUserId, user_name: currentUserName,
      content, created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", room_id: activeRoom.id, content, user_name: currentUserName }),
    })
    setSending(false)
    fetchMessages(activeRoom.id)
  }

  function handleInput(val: string) {
    setInput(val)
    // Detect @mention
    const atIdx = val.lastIndexOf("@")
    if (atIdx !== -1 && atIdx === val.length - 1) {
      setMentionQuery("")
    } else if (atIdx !== -1 && !val.slice(atIdx + 1).includes(" ")) {
      setMentionQuery(val.slice(atIdx + 1))
    } else {
      setMentionQuery(null)
    }
  }

  function insertMention(user: UserHint) {
    const name = user.full_name || user.email.split("@")[0]
    const atIdx = input.lastIndexOf("@")
    const newVal = input.slice(0, atIdx) + `@${name} `
    setInput(newVal)
    setMentionQuery(null)
    inputRef.current?.focus()
  }

  const filteredUsers = mentionQuery !== null
    ? users.filter(u => (u.full_name || u.email).toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
    : []

  function openRoom(room: Room) {
    setActiveRoom(room)
    setMessages([])
  }

  function backToRooms() {
    setActiveRoom(null)
    if (pollRef.current) clearInterval(pollRef.current)
    fetchRooms()
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center"
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
            {totalUnread > 99 ? "99" : totalUnread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-600 text-white">
            {activeRoom ? (
              <>
                <button onClick={backToRooms} className="hover:opacity-70 transition-opacity"><ArrowLeft className="w-4 h-4" /></button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{activeRoom.name}</p>
                </div>
              </>
            ) : (
              <>
                <MessageSquare className="w-5 h-5 shrink-0" />
                <p className="font-semibold text-sm flex-1">Messagerie équipe</p>
              </>
            )}
          </div>

          {/* Rooms list */}
          {!activeRoom && (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {rooms.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">Aucune salle disponible</p>
              )}
              {rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => openRoom(room)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${room.type === "global" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"}`}>
                    {room.type === "global" ? <Hash className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{room.name}</p>
                    <p className="text-xs text-gray-400">{room.type === "global" ? "Toute l'équipe" : "Discussion document"}</p>
                  </div>
                  {(unread[room.id] ?? 0) > 0 && (
                    <span className="w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0">
                      {unread[room.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Messages view */}
          {activeRoom && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-6">Aucun message. Commencez la conversation !</p>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.user_id === currentUserId
                  const showName = !isMe && (i === 0 || messages[i - 1].user_id !== msg.user_id)
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {showName && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[9px] font-bold flex items-center justify-center">
                            {initials(msg.user_name)}
                          </div>
                          <span className="text-xs font-medium text-gray-500">{msg.user_name}</span>
                        </div>
                      )}
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${isMe ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}>
                        {renderContent(msg.content)}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-0.5 px-1">{formatTime(msg.created_at)}</span>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Mention autocomplete */}
              {filteredUsers.length > 0 && (
                <div className="border-t border-gray-100 bg-white">
                  {filteredUsers.map((u, i) => (
                    <button
                      key={u.id}
                      onClick={() => insertMention(u)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-50 ${i === mentionCursor ? "bg-gray-50" : ""}`}
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center">
                        {initials(u.full_name || u.email)}
                      </div>
                      <span className="font-medium text-gray-800">{u.full_name || u.email}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-2">
                <button
                  onClick={() => { setInput(prev => prev + "@"); setMentionQuery(""); inputRef.current?.focus() }}
                  className="text-gray-400 hover:text-blue-500 transition-colors shrink-0"
                  title="Mentionner quelqu'un"
                >
                  <AtSign className="w-4 h-4" />
                </button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => handleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Message…"
                  className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder-gray-400"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-blue-700 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
