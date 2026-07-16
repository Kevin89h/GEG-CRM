"use client"

import { useEffect, useState } from "react"
import { Download, X, Share } from "lucide-react"

type Mode = "chrome" | "ios" | null

export default function PwaInstallBanner() {
  const [mode, setMode] = useState<Mode>(null)
  const [prompt, setPrompt] = useState<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (localStorage.getItem("pwa-install-dismissed") === "1") return
    if (window.matchMedia("(display-mode: standalone)").matches) return

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
    if (isIos) {
      setMode("ios")
      return
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setPrompt(e as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> })
      setMode("chrome")
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall)
  }, [])

  function dismiss() {
    localStorage.setItem("pwa-install-dismissed", "1")
    setDismissed(true)
  }

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === "accepted") dismiss()
    else setDismissed(true)
  }

  if (dismissed || !mode) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-4">
      <button onClick={dismiss} className="absolute top-3 right-3 text-slate-400 hover:text-white">
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="GEG CRM" className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Installer GEG CRM</p>

          {mode === "chrome" && (
            <>
              <p className="text-xs text-slate-400 mt-0.5">Accès rapide depuis votre bureau, sans navigateur.</p>
              <button
                onClick={install}
                className="mt-3 flex items-center gap-2 bg-white text-slate-900 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Installer l'application
              </button>
            </>
          )}

          {mode === "ios" && (
            <>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Appuyez sur{" "}
                <Share className="w-3 h-3 inline-block align-middle" />{" "}
                <strong className="text-white">Partager</strong> puis{" "}
                <strong className="text-white">Sur l'écran d'accueil</strong>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
