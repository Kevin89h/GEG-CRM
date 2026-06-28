"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"

export default function AcceptInvitePage() {
  const { locale } = useParams<{ locale: string }>()
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Capture hash BEFORE createClient() clears it (createBrowserClient processes hash on init)
    const rawHash = window.location.hash.slice(1)
    const hashParams = rawHash ? new URLSearchParams(rawHash) : null
    const accessToken = hashParams?.get("access_token") ?? null
    const refreshToken = hashParams?.get("refresh_token") ?? null

    const supabase = createClient()

    // Listen first to catch the SIGNED_IN event fired by createClient() hash processing
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION")) {
        setReady(true)
      }
    })

    async function init() {
      // If hash tokens are still in the URL, establish the session explicitly
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        if (!error) {
          setReady(true)
          window.history.replaceState(null, "", window.location.pathname)
          return
        }
      }

      // Retry getSession() — may need a few ticks after createClient() processes the hash
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 300))
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setReady(true)
          return
        }
      }

      // If still no session after retries, show an error
      setError("Le lien d'invitation a expiré ou est invalide. Demandez un nouvel accès à votre administrateur.")
    }

    init()
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }
    setLoading(true)
    setError("")

    const supabase = createClient()
    const { error: authError } = await supabase.auth.updateUser({ password })

    if (authError) {
      setError("Erreur lors de la création du mot de passe. Veuillez réessayer.")
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => router.push(`/${locale}/dashboard`), 2500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="w-full max-w-md px-4">
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

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-1">Bienvenue dans GEG CRM</h2>
          <p className="text-slate-400 text-sm mb-6">Créez votre mot de passe pour accéder à votre compte.</p>

          {done ? (
            <div className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-3">
              ✅ Compte activé ! Redirection vers le tableau de bord…
            </div>
          ) : !ready ? (
            <div className="text-center py-6">
              {error ? (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-3">
                  {error}
                </p>
              ) : (
                <>
                  <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Vérification du lien d'invitation…</p>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Minimum 8 caractères"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Confirmer le mot de passe
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
                disabled={loading || !password || !confirm}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                {loading ? "Activation…" : "Activer mon compte"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
