"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ReactNode } from "react"

interface Props {
  children: ReactNode
}

export default function ParametresLayout({ children }: Props) {
  const pathname = usePathname()
  // Extract locale from path: /fr/parametres/...
  const locale = pathname.split("/")[1]

  const tabs = [
    { label: "Taux de change", href: `/${locale}/parametres/taux-de-change` },
    { label: "Documents", href: `/${locale}/parametres/documents` },
    { label: "Unités", href: `/${locale}/parametres/unites` },
    { label: "Utilisateurs", href: `/${locale}/parametres/utilisateurs` },
    { label: "Journal d'activité", href: `/${locale}/parametres/activite` },
  ]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
      </div>
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(tab => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                active
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
      {children}
    </div>
  )
}
