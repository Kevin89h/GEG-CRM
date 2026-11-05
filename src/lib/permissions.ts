// Permissions of the CRM (PLAN_PERMISSIONS_PERSONNALISABLES_GEG.md).
// The catalogue, the role standards and the personal exceptions per company live in the database
// (permission_catalog, role_permissions, user_permission_overrides); effective rights are computed there
// by public.effective_permissions(user, company). This file only maps pages and API routes to permission keys.
// Shared by the middleware, the server and the client: no server-only imports here.

/** Effective permission keys of a user in one company */
export type PermissionSet = readonly string[]

/** True when the set holds at least one of the keys */
export function allows(perms: PermissionSet | null | undefined, keys: string | readonly string[]): boolean {
  if (!perms) return false
  const list = typeof keys === "string" ? [keys] : keys
  return list.some(k => perms.includes(k))
}

// ---------------------------------------------------------------------------------------------
// API routes: permission needed per path and method (any of the listed keys). First match wins.
// Routes not listed are open to any signed-in user of the company; an unlisted DELETE needs "suppression".
// Route handlers add the finer checks (document status, both companies for a transfer, user perimeter).
// ---------------------------------------------------------------------------------------------

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
interface ApiRule { path: RegExp; methods: Method[] | "*"; keys: string[] }

const W: Method[] = ["POST", "PATCH", "PUT", "DELETE"]
const ID = "[^/]+"
const r = (p: string) => new RegExp(`^/api/${p}/?$`)
const rule = (p: string, methods: Method[] | "*", ...keys: string[]): ApiRule => ({ path: r(p), methods, keys })

export const API_RULES: ApiRule[] = [
  // Administration (each route also checks the user perimeter)
  rule("logs", "*", "journal.voir"),
  rule("activity-logs", "*", "journal.voir"),
  rule("audit", "*", "journal.voir"),
  rule("accounts/merge", "*", "doublons.fusionner"),
  rule("accounts/duplicates", "*", "doublons.fusionner"),
  rule("users/[a-z-]+", W, "utilisateurs.gerer"),

  // CRM
  rule("accounts", ["POST"], "comptes.creer"),
  rule(`accounts/${ID}`, ["PATCH"], "comptes.modifier"),
  rule("contacts", ["POST"], "contacts.creer"),
  rule(`contacts/${ID}`, ["PATCH"], "contacts.modifier"),
  rule("deals", ["POST"], "opportunites.creer"),
  rule(`deals/${ID}`, ["PATCH"], "opportunites.modifier"),
  rule(`deals/${ID}/activities`, ["POST"], "activites.creer"),
  rule(`deals/${ID}/activities/${ID}`, ["PATCH"], "activites.modifier"),
  rule(`deals/${ID}/costs/${ID}`, ["PATCH"], "opportunites.couts_modifier"),
  rule(`deals/${ID}/financials`, ["POST"], "opportunites.couts_modifier"),
  rule(`deals/${ID}/financials`, ["GET"], "opportunites.couts_voir"),
  rule(`deals/${ID}/devis`, W, "devis.modifier"),
  rule(`deals/${ID}/invoice`, W, "opportunites.modifier"),
  rule(`deals/${ID}/supplier-invoice`, W, "factures_fournisseurs.gerer"),
  rule(`deals/${ID}/transfer`, "*", "opportunites.transferer"),
  rule(`deals/${ID}/delete`, "*", "suppression"),
  rule("singapore-leads", ["GET"], "opportunites.voir"),
  rule(`singapore-leads/${ID}`, ["POST"], "opportunites.transferer"),
  rule("activities", ["POST"], "activites.creer"),
  rule(`activities/${ID}`, ["PATCH"], "activites.modifier"),
  rule("documents", ["POST"], "documents.ajouter"),
  rule("documents/upload", ["POST"], "documents.ajouter"),
  rule("shipments", ["POST", "PATCH"], "expeditions.gerer"),

  // Ventes
  rule("devis", ["POST"], "devis.creer"),
  rule("devis/bulk-cancel", "*", "devis.annuler"),
  rule(`devis/${ID}`, ["PATCH"], "devis.modifier", "devis.confirmer", "devis.annuler"),
  rule(`devis/${ID}/create-invoice`, "*", "factures.creer"),
  rule(`devis/${ID}/delivery`, "*", "livraisons.creer"),
  rule(`devis/${ID}/duplicate`, "*", "devis.creer"),
  rule(`devis/${ID}/lines(/${ID})?`, W, "devis.modifier"),
  rule(`devis/${ID}/pdf`, ["GET"], "devis.voir"),
  rule("factures", ["POST"], "factures.creer"),
  rule(`factures/${ID}`, ["PATCH"], "factures.modifier_brouillon", "factures.emettre", "factures.annuler_brouillon"),
  rule(`factures/${ID}/create-delivery-note`, "*", "livraisons.creer"),
  rule(`factures/${ID}/pdf`, ["GET"], "factures.voir"),
  rule(`invoices/${ID}/(account|dates|tva)`, W, "factures.modifier_brouillon"),
  rule(`invoices/${ID}/lines(/${ID})?`, W, "factures.modifier_brouillon"),
  rule(`invoices/${ID}/credit-note`, "*", "factures.avoir"),
  rule(`invoices/${ID}/duplicate`, "*", "factures.creer"),
  rule(`invoices/${ID}/payments`, W, "paiements_clients.enregistrer"),
  rule(`invoices/${ID}/payments/${ID}`, ["DELETE"], "paiements.supprimer"),
  rule(`invoices/${ID}/status`, W, "factures.emettre", "factures.annuler_brouillon"),
  rule("invoices/bulk-cancel", "*", "factures.annuler_brouillon"),
  rule("invoices/bulk-payment", "*", "paiements_clients.enregistrer"),
  rule(`bons-livraison/${ID}/cancel`, "*", "livraisons.annuler"),
  rule(`bons-livraison/${ID}/confirm`, "*", "livraisons.confirmer"),
  rule(`bons-livraison/${ID}/pdf`, ["GET"], "livraisons.voir"),
  rule("document-tokens", "*", "devis.voir", "factures.voir", "livraisons.voir"),

  // Achats
  rule("achats", ["POST"], "achats.creer"),
  rule(`achats/${ID}/cancel`, "*", "achats.annuler"),
  rule(`achats/${ID}/notes`, ["POST"], "achats.modifier"),
  rule(`achats/${ID}/notes`, ["GET"], "achats.voir"),
  rule(`achats/${ID}/receive`, "*", "achats.receptionner"),
  rule(`achats/${ID}/status`, W, "achats.modifier", "achats.annuler", "achats.receptionner"),
  rule(`achats/${ID}/(costs|lines)(/${ID})?`, W, "achats.modifier"),
  rule(`achats/costs/${ID}`, W, "achats.modifier"),
  rule("(fournisseurs|suppliers)", ["POST"], "fournisseurs.gerer"),
  rule(`(fournisseurs|suppliers)/${ID}`, ["PATCH", "DELETE"], "fournisseurs.gerer"),
  rule(`suppliers/${ID}/reactivate`, ["POST"], "fournisseurs.gerer"),
  rule(`supplier-invoices/${ID}/payments/${ID}`, ["DELETE"], "paiements.supprimer"),
  rule(`supplier-invoices/${ID}/payments`, ["POST"], "paiements_fournisseurs.enregistrer"),
  rule("supplier-invoices/bulk-payment", "*", "paiements_fournisseurs.enregistrer"),
  rule(`supplier-invoices/${ID}`, ["PATCH"], "factures_fournisseurs.gerer", "factures_fournisseurs.annuler"),
  rule("supplier-invoices(/import|/" + ID + "/(credit-note|duplicate))?", ["POST"], "factures_fournisseurs.gerer"),
  { path: /^\/api\/supplier-invoices(\/|$)/, methods: ["GET"], keys: ["factures_fournisseurs.voir"] },

  // Comptabilité, trésorerie
  { path: /^\/api\/(treasury|tresorerie)\/accounts\/[^/]+\/?$/, methods: ["DELETE"], keys: ["comptes_bancaires.supprimer"] },
  { path: /^\/api\/(treasury|tresorerie)\/accounts(\/|$)/, methods: W, keys: ["tresorerie.comptes"] },
  { path: /^\/api\/(treasury|tresorerie)\/transactions\/export/, methods: "*", keys: ["tresorerie.saisir"] },
  { path: /^\/api\/(treasury|tresorerie)\/transactions(\/|$)/, methods: ["POST", "PATCH", "PUT"], keys: ["tresorerie.saisir"] },
  { path: /^\/api\/(treasury|tresorerie)(\/|$)/, methods: ["GET"], keys: ["tresorerie.voir"] },
  rule(`employes/${ID}/pay-commission`, "*", "commissions.gerer"),

  // Stock, produits
  rule("stock/mouvement", "*", "stock.mouvement_manuel"),
  rule("inventaire/save", "*", "stock.inventaire"),
  rule("warehouses", W, "stock.entrepots"),
  rule(`stock/produits/${ID}`, ["DELETE"], "suppression"),
  { path: /^\/api\/stock\/produits(\/|$)/, methods: W, keys: ["produits.gerer"] },
  rule("projets", ["GET"], "projets.voir"),

  // Équipe, paramètres, assistant
  rule("employes", ["POST"], "employes.gerer"),
  rule(`employes/${ID}`, ["PATCH"], "employes.gerer"),
  rule("units", ["POST"], "parametres.gerer"),
  rule(`units/${ID}`, ["PATCH"], "parametres.gerer"),
  rule("exchange-rates/refresh", "*", "parametres.gerer"),
  { path: /^\/api\/parametres\//, methods: W, keys: ["parametres.gerer"] },
  rule("ai/chat", "*", "assistant_ia.utiliser"),

  // Deletions not listed above: never for commercials; personal data and notifications stay free
  { path: /^\/api\/(notifications|push|chat|profile)(\/|$)/, methods: ["DELETE"], keys: [] },
  { path: /^\/api\//, methods: ["DELETE"], keys: ["suppression"] },
]

/** Keys an API call needs (any of), null when any signed-in user of the company may make it. */
export function apiPermissions(pathname: string, method: string): string[] | null {
  const m = method.toUpperCase() as Method
  const found = API_RULES.find(x => x.path.test(pathname) && (x.methods === "*" || x.methods.includes(m)))
  return found && found.keys.length ? found.keys : null
}

// ---------------------------------------------------------------------------------------------
// Pages (path without the locale): permission needed to open them. Longest matching prefix wins.
// ---------------------------------------------------------------------------------------------

export const PAGE_RULES: Record<string, string[]> = {
  "accounts": ["comptes.voir"],
  "comptes": ["comptes.voir"],
  "comptes/doublons": ["doublons.fusionner"],
  "contacts": ["contacts.voir"],
  "contacts/fournisseurs": ["fournisseurs.voir"],
  "deals": ["opportunites.voir"],
  "deals/dashboard": ["opportunites.couts_voir"],
  "singapore-leads": ["opportunites.voir"],
  "activities": ["activites.voir"],
  "ventes": ["devis.voir", "factures.voir", "livraisons.voir"],
  "ventes/devis": ["devis.voir"],
  "ventes/devis/nouveau": ["devis.creer"],
  "ventes/factures": ["factures.voir"],
  "ventes/factures/nouveau": ["factures.creer"],
  "ventes/bons-livraison": ["livraisons.voir"],
  "achats": ["achats.voir"],
  "achats/nouveau": ["achats.creer"],
  "achats/fournisseurs": ["fournisseurs.voir"],
  "stock": ["stock.voir"],
  "stock/produits": ["produits.voir"],
  "stock/inventaire": ["stock.inventaire"],
  "stock/mouvements/nouveau": ["stock.mouvement_manuel"],
  "stock/pertes": ["stock.mouvement_manuel"],
  "comptabilite": ["tresorerie.voir"],
  "comptabilite/factures-fournisseurs": ["factures_fournisseurs.voir"],
  "comptabilite/factures-fournisseurs/nouveau": ["factures_fournisseurs.gerer"],
  "comptabilite/paiements": ["tresorerie.voir"],
  "comptabilite/paiements-fournisseurs": ["paiements_fournisseurs.enregistrer"],
  "comptabilite/resultat": ["resultat.voir"],
  "employes": ["employes.voir"],
  "documents": ["documents.voir"],
  "projets": ["projets.voir"],
  "tracking": ["expeditions.voir"],
  "ai": ["assistant_ia.utiliser"],
  "parametres/taux-de-change": ["parametres.gerer"],
  "parametres/unites": ["parametres.gerer"],
  "parametres/documents": ["parametres.gerer"],
  "parametres/utilisateurs": ["utilisateurs.gerer"],
  "parametres/activite": ["journal.voir"],
  "parametres/audit": ["journal.voir"],
}

/** Keys a page needs (any of), null when every signed-in user of the company may open it. */
export function pagePermissions(path: string): string[] | null {
  const clean = path.replace(/^\/+|\/+$/g, "")
  const prefix = Object.keys(PAGE_RULES)
    .filter(p => clean === p || clean.startsWith(p + "/"))
    .sort((a, b) => b.length - a.length)[0]
  return prefix ? PAGE_RULES[prefix] : null
}

/** Permissions that only come from the role (never granted nor removed by exception) */
export const RESERVED_PERMISSIONS = ["utilisateurs.gerer", "journal.voir", "doublons.fusionner", "societes.gerer", "comptes_bancaires.supprimer"]
