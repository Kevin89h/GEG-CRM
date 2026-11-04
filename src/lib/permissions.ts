// Fixed rights of each role (decisions D1 to D8 of 04/11/2026). No individual grid any more:
// every account with the same role has the same rights, in its own companies only.
// The database mirrors this table in public.has_capability() (keep both in sync).
// Shared by the middleware, the server and the client: no server-only imports here.

export const CAPABILITIES = [
  "crm.write",        // accounts, contacts, opportunities, activities, documents, shipments: create and edit
  "sales.write",      // quotes, orders, draft invoices, invoice emission, delivery notes, quote cancellation
  "sales.correct",    // credit notes, cancellation of an emitted invoice, transfer of an opportunity between companies
  "payments.write",   // customer payments
  "purchases.view",   // purchase orders, receptions, suppliers (read only)
  "purchases.write",  // purchase orders, receptions, supplier invoices and payments, suppliers
  "treasury.view",    // bank accounts, treasury operations, payments lists, result, accounting exports
  "treasury.write",
  "stock.write",      // manual stock moves, inventory adjustments, losses, warehouses
  "products.write",   // product creation and editing (D4)
  "employees.write",  // employees and commissions
  "settings.write",   // exchange rates, units, document settings
  "delete",           // any deletion (never for commercials, D5)
  "users.manage",     // user accounts of one's companies, activity log
  "duplicates.merge", // merging duplicate accounts (D4, dedicated command to come)
  "companies.manage", // assigning companies, editing companies
] as const

export type Capability = (typeof CAPABILITIES)[number]

const MANAGER: Capability[] = [
  "crm.write", "sales.write", "sales.correct", "payments.write", "purchases.view", "purchases.write",
  "treasury.view", "treasury.write", "stock.write", "products.write", "employees.write", "settings.write", "delete",
]

export const ROLE_CAPABILITIES: Record<string, Capability[]> = {
  sales_rep: ["crm.write", "sales.write", "purchases.view"],
  manager: MANAGER,
  admin: [...MANAGER, "users.manage", "duplicates.merge"],
  super_admin: [...CAPABILITIES],
}

/** Blocked accounts and unknown roles have no right at all. */
export function can(role: string | null | undefined, capability: Capability, blocked = false): boolean {
  if (blocked || !role) return false
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false
}

/** Short French description of what each role does, shown on the users screen. */
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: "Tout, dans toutes ses sociétés, y compris l'attribution des sociétés et les comptes des admins.",
  admin: "Tout le travail de ses sociétés et les comptes utilisateurs de ces sociétés (hors super admins et comptes multi-sociétés).",
  manager: "Tout le travail de ses sociétés : ventes, achats, paiements, trésorerie, stock, produits, avoirs. Pas de gestion des comptes.",
  sales_rep: "Clients, opportunités, devis, factures (création, modification en brouillon, émission) et livraisons. Consultation des achats, du stock et des produits. Ni trésorerie, ni paiements, ni ajustements de stock, ni suppressions.",
}

// ---------------------------------------------------------------------------------------------
// API routes: capability needed per path and method. First matching rule wins.
// Routes not listed are open to any signed-in user of the company (reads, notifications, chat...).
// ---------------------------------------------------------------------------------------------

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
interface ApiRule { path: RegExp; methods: Method[] | "*"; cap: Capability }

const W: Method[] = ["POST", "PATCH", "PUT", "DELETE"]
const ID = "[^/]+"
const r = (p: string) => new RegExp(`^/api/${p}/?$`)

export const API_RULES: ApiRule[] = [
  // Users and administration (also checked in each route)
  { path: r("logs"), methods: "*", cap: "users.manage" },
  { path: r("activity-logs"), methods: "*", cap: "users.manage" },
  { path: r(`accounts/merge`), methods: "*", cap: "duplicates.merge" },
  { path: r(`accounts/duplicates`), methods: "*", cap: "duplicates.merge" },

  // Treasury, payments, accounting
  { path: new RegExp(`^/api/(treasury|tresorerie)/`), methods: "*", cap: "treasury.write" },
  { path: r(`invoices/${ID}/payments(/${ID})?`), methods: W, cap: "payments.write" },
  { path: r(`invoices/bulk-payment`), methods: "*", cap: "payments.write" },
  { path: new RegExp(`^/api/supplier-invoices(/|$)`), methods: "*", cap: "purchases.write" },
  { path: r(`deals/${ID}/supplier-invoice`), methods: W, cap: "purchases.write" },
  { path: r(`employes/${ID}/pay-commission`), methods: "*", cap: "employees.write" },
  // Costs of an opportunity (margin): read only for commercials
  { path: r(`deals/${ID}/(costs/${ID}|financials)`), methods: W, cap: "purchases.write" },

  // Corrections: credit notes, bulk invoice cancellation, transfers between companies
  { path: r(`invoices/${ID}/credit-note`), methods: "*", cap: "sales.correct" },
  { path: r(`invoices/bulk-cancel`), methods: "*", cap: "sales.correct" },
  { path: r(`deals/${ID}/transfer`), methods: "*", cap: "sales.correct" },
  { path: r(`singapore-leads/${ID}`), methods: ["POST"], cap: "sales.correct" },

  // Purchases, suppliers
  { path: new RegExp(`^/api/achats(/|$)`), methods: W, cap: "purchases.write" },
  { path: new RegExp(`^/api/(fournisseurs|suppliers)(/|$)`), methods: W, cap: "purchases.write" },

  // Stock and products
  { path: new RegExp(`^/api/(stock/mouvement|inventaire|warehouses)(/|$)`), methods: W, cap: "stock.write" },
  { path: new RegExp(`^/api/stock/produits(/|$)`), methods: W, cap: "products.write" },

  // Employees, settings
  { path: new RegExp(`^/api/employes(/|$)`), methods: W, cap: "employees.write" },
  { path: new RegExp(`^/api/(units|parametres|exchange-rates/refresh)(/|$)`), methods: W, cap: "settings.write" },

  // Deletions: never for commercials, except removing a line of a document they may still edit
  { path: r(`devis/${ID}/lines/${ID}`), methods: ["DELETE"], cap: "sales.write" },
  { path: r(`invoices/${ID}/lines/${ID}`), methods: ["DELETE"], cap: "sales.write" },
  { path: r(`deals/${ID}/devis`), methods: ["DELETE"], cap: "sales.write" },
  { path: new RegExp(`^/api/(notifications|push|chat|profile)(/|$)`), methods: ["DELETE"], cap: "sales.write" },
  { path: /^\/api\//, methods: ["DELETE"], cap: "delete" },
  { path: r(`deals/${ID}/delete`), methods: "*", cap: "delete" },

  // Everyday commercial work
  { path: new RegExp(`^/api/(devis|factures|invoices|bons-livraison|document-tokens)(/|$)`), methods: W, cap: "sales.write" },
  { path: new RegExp(`^/api/deals/${ID}/(invoice|devis)$`), methods: W, cap: "sales.write" },
  { path: new RegExp(`^/api/(accounts|contacts|deals|activities|documents|shipments)(/|$)`), methods: W, cap: "crm.write" },
]

/** Capability an API call needs, or null when any signed-in user of the company may make it. */
export function apiCapability(pathname: string, method: string): Capability | null {
  const m = method.toUpperCase() as Method
  const rule = API_RULES.find(x => x.path.test(pathname) && (x.methods === "*" || x.methods.includes(m)))
  return rule?.cap ?? null
}

// ---------------------------------------------------------------------------------------------
// Pages: capability needed to open a page (path without the locale). First matching prefix wins.
// ---------------------------------------------------------------------------------------------

export const PAGE_RULES: { prefix: string; cap: Capability }[] = [
  { prefix: "achats/nouveau", cap: "purchases.write" },
  { prefix: "stock/mouvements/nouveau", cap: "stock.write" },
  { prefix: "stock/inventaire", cap: "stock.write" },
  { prefix: "stock/pertes", cap: "stock.write" },
  { prefix: "comptabilite", cap: "treasury.view" },
  { prefix: "parametres/taux-de-change", cap: "settings.write" },
  { prefix: "parametres/unites", cap: "settings.write" },
  { prefix: "parametres/documents", cap: "settings.write" },
]

export function pageCapability(path: string): Capability | null {
  const clean = path.replace(/^\/+/, "")
  return PAGE_RULES.find(p => clean === p.prefix || clean.startsWith(p.prefix + "/"))?.cap ?? null
}
