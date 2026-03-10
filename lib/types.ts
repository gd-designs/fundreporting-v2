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
  // type-specific optional fields
  currency?: number        // FK to currency table
  _currency?: { id: number; code: string; name: string } | null
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

export type DashboardSnapshot = {
  entitySnapshots: EntitySnapshot[]
  tasks: never[]
  documents: never[]
  totals: DashboardTotals
}
