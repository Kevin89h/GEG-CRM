import Link from "next/link"
import { Lock } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { getAccess } from "@/lib/access"
import { roleLabel } from "@/lib/roles"
import { ADMIN_AREA, NAV_ITEMS } from "@/lib/navigation"
import RequestAccessButton from "./RequestAccessButton"

export default async function AccessDeniedPage({ params, searchParams }: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ m?: string; p?: string }>
}) {
  const { locale } = await params
  const { m, p } = await searchParams
  const [t, tNav, access] = await Promise.all([getTranslations("access"), getTranslations("nav"), getAccess()])

  const item = NAV_ITEMS.find(i => i.key === m)
  const moduleLabel = item ? tNav(item.key) : ""
  const message = m === ADMIN_AREA || !item
    ? t("adminMessage")
    : item.company
      ? t("companyMessage", { module: moduleLabel })
      : t("message", { module: moduleLabel, role: roleLabel(access?.role) })

  return (
    <div className="max-w-lg mx-auto mt-16 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-6 h-6 text-amber-600" />
      </div>
      <h1 className="text-lg font-semibold text-gray-900 mb-2">{t("title")}</h1>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex flex-col items-center gap-3">
        {item && <RequestAccessButton moduleKey={item.key} permission={p} />}
        <Link href={`/${locale}/dashboard`} className="text-sm text-gray-500 hover:text-blue-600">
          {t("back")}
        </Link>
      </div>
    </div>
  )
}
