export type EntityType =
  | 'portfolio'
  | 'company'
  | 'family_office'
  | 'asset_manager'
  | 'fund'

export type UnifiedEntity = {
  id: string         // sub-table UUID
  entity: string     // entity table UUID
  name: string | null
  created_at: string
  type: EntityType
  _access?: Array<{ type: "shareholder" | "team_member"; role: string | null; department?: string | null }> | null
  // type-specific optional fields
  currency?: number        // FK to currency table
  _currency?: { id: number; code: string; name: string } | null
  _country?: { id: number; name?: string; code?: string } | null
  inception_date?: string
  registration_number?: string
  country?: string | number
  industry?: string
  fund_type?: string
  aum?: number
}

export type Asset = {
  id: string
  created_at: string
  entity: string
  name: string | null
  description: string | null
  amount: number | null
  currency: number | null        // FK → currency table
  quantity: number | null
  cost: number | null
  asset_class: number | null     // FK → asset_class table
  country: number | null
  investable: "investable_cash" | "investable_convert" | "non_investable" | "equity_stake" | null
  cap_table_shareholder?: string | null
  taxable: "taxable" | "tax_deferred" | "tax_free" | null
  notes: string | null
  order: number | null
  purchasedAt: string | null
  indicativeRate: number | null
  locked: boolean | null
}

export type Currency = {
  id: number
  code: string
  name: string
}

export type AssetClass = {
  id: number
  name: string
}

export type EntitySnapshot = {
  entity: UnifiedEntity
  assetsValue: number
  netValue: number
  assetsCount: number
  liabilitiesValue: number
  tasksOpen: number
  href: string
}

export type DashboardTotals = {
  entities: number
  portfolios: number
  companies: number
  assetsValue: number
  liabilitiesValue: number
  netValue: number
  openTasks: number
  documents: number
}

export type Task = {
  id: string
  title?: string | null
  status?: "todo" | "in_progress" | "done" | "cancelled" | null
  priority?: "low" | "medium" | "high" | null
  due_date?: number | null
  entity?: string | null
  created_at?: number | null
}

export type Document = {
  id: string
  name?: string | null
  entity?: string | null
  created_at?: number | null
  object_type?: string | null
}

export type DashboardSnapshot = {
  entitySnapshots: EntitySnapshot[]
  tasks: Task[]
  documents: Document[]
  totals: DashboardTotals
}
