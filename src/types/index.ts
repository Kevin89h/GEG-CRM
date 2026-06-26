export type AccountType = "government" | "enterprise" | "sme"

// ─── Stock ────────────────────────────────────────────────────────────────────
export type StockMoveType = "in" | "out" | "transfer" | "adjustment"
export type UnitType = "volume" | "weight" | "unit"

export interface ProductCategory {
  id: string
  name: string
  color: string
  created_at: string
}

export interface Unit {
  id: string
  name: string
  type: UnitType
}

export interface Product {
  id: string
  reference: string | null
  name: string
  category_id: string | null
  unit_id: string | null
  description: string | null
  buy_price: number | null
  sell_price: number | null
  currency: "USD" | "GNF" | "EUR"
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Warehouse {
  id: string
  name: string
  city: string | null
  address: string | null
  is_active: boolean
  created_at: string
}

export interface StockLevel {
  id: string
  product_id: string
  warehouse_id: string
  quantity: number
  updated_at: string
}

export interface StockMove {
  id: string
  type: StockMoveType
  product_id: string
  from_warehouse_id: string | null
  to_warehouse_id: string | null
  quantity: number
  reference: string | null
  notes: string | null
  date: string
  user_id: string
  created_at: string
}

export type ProductFull = Product & {
  category: ProductCategory | null
  unit: Unit | null
}

export type StockLevelFull = StockLevel & {
  product: ProductFull
  warehouse: Warehouse
}

export type StockMoveFull = StockMove & {
  product: Product
  from_warehouse: Warehouse | null
  to_warehouse: Warehouse | null
}
export type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost"
export type ActivityType = "call" | "meeting" | "email" | "note"
export type UserRole = "admin" | "manager" | "sales_rep"

export interface Account {
  id: string
  name: string
  type: AccountType
  industry: string | null
  country: string
  city: string | null
  phone: string | null
  email: string | null
  website: string | null
  notes: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  account_id: string
  first_name: string
  last_name: string
  title: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  account_id: string
  title: string
  stage: DealStage
  value: number | null
  currency: "USD" | "GNF" | "EUR"
  probability: number | null
  close_date: string | null
  owner_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  type: ActivityType
  subject: string
  notes: string | null
  date: string
  follow_up_date: string | null
  completed: boolean
  account_id: string | null
  contact_id: string | null
  deal_id: string | null
  user_id: string
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
}

export type AccountWithContacts = Account & { contacts: Contact[] }
export type DealWithAccount = Deal & { account: Account }
export type ActivityWithRelations = Activity & {
  account: Account | null
  deal: Deal | null
  contact: Contact | null
}
