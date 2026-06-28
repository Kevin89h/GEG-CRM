"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { Camera } from "lucide-react"
import type { Profile } from "@/types"
import { initials } from "@/lib/utils"

interface Props {
  profile: Profile | null
}

const roleLabels: Record<string, string> = {
  admin: "Administrateur",
  manager: "Responsable",
  sales_rep: "Commercial",
}

export default function ProfilClient({ profile }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "")
  const [phone, setPhone] = useState(profile?.phone ?? "")
  const [jobTitle, setJobTitle] = useState(profile?.job_title ?? "")
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "")
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const form = new FormData()
    form.append("file", file)

    try {
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form })
      if (res.ok) {
        const data = await res.json()
        setAvatarUrl(data.avatar_url)
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone, job_title: jobTitle, avatar_url: avatarUrl }),
      })
      setToast(true)
      setTimeout(() => setToast(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const displayName = fullName || profile?.email || ""
  const role = profile?.role ?? "sales_rep"

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Mon profil</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {/* Avatar */}
        <div className="flex items-center gap-5 mb-6">
          <button
            type="button"
            className="relative w-24 h-24 rounded-full overflow-hidden flex-shrink-0 group focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Changer la photo de profil"
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-blue-600 flex items-center justify-center">
                <span className="text-white text-2xl font-semibold">
                  {initials(displayName)}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div>
            <p className="text-lg font-medium text-gray-900">{displayName}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              {roleLabels[role] ?? role}
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Email read-only */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Adresse e-mail</label>
            <input
              type="email"
              value={profile?.email ?? ""}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>

          {/* Role read-only */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Rôle</label>
            <input
              type="text"
              value={roleLabels[role] ?? role}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>

          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Votre nom complet"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+224 000 000 000"
            />
          </div>

          {/* Job title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poste / Fonction</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex. Responsable commercial"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          </div>
        </form>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white text-sm font-medium px-4 py-3 rounded-lg shadow-lg">
          Profil mis à jour avec succès
        </div>
      )}
    </div>
  )
}
