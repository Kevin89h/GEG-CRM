"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Check, Loader2, Send } from "lucide-react"

export default function RequestAccessButton({ moduleKey, permission }: { moduleKey: string; permission?: string }) {
  const t = useTranslations("access")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "already" | "error">("idle")

  async function request() {
    setState("sending")
    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleKey, permission }),
      })
      const body = await res.json().catch(() => ({}))
      setState(!res.ok ? "error" : body.already ? "already" : "sent")
    } catch {
      setState("error")
    }
  }

  if (state === "sent" || state === "already") {
    return (
      <p className="text-sm text-emerald-700 flex items-center gap-1.5">
        <Check className="w-4 h-4" /> {t(state === "sent" ? "requested" : "alreadyRequested")}
      </p>
    )
  }

  return (
    <>
      <button onClick={request} disabled={state === "sending"}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
        {state === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {t("request")}
      </button>
      {state === "error" && <p className="text-xs text-red-600">{t("error")}</p>}
    </>
  )
}
