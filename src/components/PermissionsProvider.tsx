"use client"

// Effective permissions of the signed-in user in the ACTIVE company (role standard + personal exceptions
// of that company), provided by the app layout. Used to hide or disable action buttons inside pages (D2).
// This is display only: every action is checked again by the server and by the database.
import { createContext, useContext, useMemo } from "react"
import { allows } from "@/lib/permissions"

const PermissionsContext = createContext<readonly string[]>([])

export function PermissionsProvider({ perms, children }: { perms: string[]; children: React.ReactNode }) {
  return <PermissionsContext.Provider value={perms}>{children}</PermissionsContext.Provider>
}

/** const { can } = usePerms(); can("factures.emettre") or can(["devis.modifier", "devis.annuler"]) (any of) */
export function usePerms() {
  const perms = useContext(PermissionsContext)
  return useMemo(() => ({ perms, can: (keys: string | readonly string[]) => allows(perms, keys) }), [perms])
}

/** Renders its children only when the user holds one of the keys */
export function Can({ perm, children, fallback = null }: { perm: string | string[]; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { can } = usePerms()
  return <>{can(perm) ? children : fallback}</>
}
