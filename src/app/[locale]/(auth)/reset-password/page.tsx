"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const t = useTranslations("auth")
  const { locale } = useParams<{ locale: string }>()
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError(t("passwordMismatch"))
      return
    }
    setLoading(true)
    setError("")

    const supabase = createClient()
    const { error: authError } = await supabase.auth.updateUser({ password })

    if (authError) {
      setError(t("passwordResetError"))
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => router.push(`/${locale}/login`), 2500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/geg-logo.png"
            alt="GEG Logo"
            width={200}
            height={80}
            className="mx-auto mb-4 brightness-0 invert"
            priority
          />
          <p className="text-blue-300 mt-1 text-sm">CRM</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-1">{t("resetPassword")}</h2>

          {done ? (
            <p className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-3 mt-4">
              ✅ {t("passwordUpdated")}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  {t("newPassword")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  {t("confirmPassword")}
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                {loading ? "..." : t("resetPassword")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
