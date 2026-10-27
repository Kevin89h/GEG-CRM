"use client"

import { useTranslations } from "next-intl"
import { useRouter, useParams } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"

export default function NoCompanyPage() {
  const t = useTranslations("auth")
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${locale}/login`)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="w-full max-w-md">
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
          <h2 className="text-xl font-semibold text-white mb-1">{t("noCompanyTitle")}</h2>
          <p className="text-slate-400 text-sm mb-6">{t("noCompanyMessage")}</p>
          <button
            onClick={handleLogout}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {t("logout")}
          </button>
        </div>
      </div>
    </div>
  )
}
