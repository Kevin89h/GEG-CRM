"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"

export default function ForgotPasswordPage() {
  const t = useTranslations("auth")
  const { locale } = useParams<{ locale: string }>()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const supabase = createClient()
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/${locale}/reset-password`,
    })

    if (authError) {
      setError(t("resetEmailError"))
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
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
          <h2 className="text-xl font-semibold text-white mb-1">{t("forgotPasswordTitle")}</h2>
          <p className="text-slate-400 text-sm mb-6">{t("forgotPasswordDesc")}</p>

          {sent ? (
            <div className="space-y-4">
              <p className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-3">
                ✅ {t("resetEmailSent")}
              </p>
              <Link
                href={`/${locale}/login`}
                className="block text-center text-sm text-blue-400 hover:text-blue-300 transition"
              >
                ← {t("backToLogin")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  {t("email")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="vous@geg.com"
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
                {loading ? "..." : t("sendResetLink")}
              </button>

              <Link
                href={`/${locale}/login`}
                className="block text-center text-sm text-slate-400 hover:text-slate-300 transition"
              >
                ← {t("backToLogin")}
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
