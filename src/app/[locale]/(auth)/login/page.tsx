"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const t = useTranslations("auth")
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("crm_remembered_email")
    if (saved) setEmail(saved)
  }, [])

  // Detect invite token in URL hash and redirect to accept-invite page
  useState(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash
    if (hash.includes("type=invite")) {
      router.replace(`/${locale}/accept-invite${hash}`)
    }
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(t("loginError"))
      setLoading(false)
      return
    }
    if (rememberMe) {
      localStorage.setItem("crm_remembered_email", email)
    } else {
      localStorage.removeItem("crm_remembered_email")
    }
    // Log connexion (fire-and-forget)
    fetch("/api/auth/log-login", { method: "POST" }).catch(() => {})
    router.push(`/${locale}/dashboard`)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <Image
            src="/geg-logo-white.svg"
            alt="GEG Logo"
            width={220}
            height={80}
            className="mx-auto mb-4"
            priority
          />
          <p className="text-blue-300 mt-1 text-sm">CRM</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-1">{t("welcomeBack")}</h2>
          <p className="text-slate-400 text-sm mb-6">{t("loginToContinue")}</p>

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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  {t("password")}
                </label>
                <Link
                  href={`/${locale}/forgot-password`}
                  className="text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="remember-me" className="text-sm text-slate-300 cursor-pointer select-none">
                Se souvenir de moi
              </label>
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
              {loading ? "..." : t("loginButton")}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
