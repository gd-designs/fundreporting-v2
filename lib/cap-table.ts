"use client"

export type ShareClassFee = {
  id: string
  share_class?: string | null
  entity?: string | null
  type?: "management" | "performance" | "entry" | "exit" | "administration" | "setup" | "other" | null
  rate?: number | null
  basis?: "nav" | "committed_capital" | "call_amount" | "profit" | "fixed" | null
  frequency?: "one_time" | "monthly" | "quarterly" | "semi_annual" | "annual" | null
  hurdle_rate?: number | null
  high_water_mark?: boolean | null
  catch_up_rate?: number | null
  fixed_amount?: number | null
  notes?: string | null
  created_at?: number | null
}

export type ShareClass = {
  id: string
  entity: string
  name: string | null
  voting_rights: boolean | null
  liquidation_preference: number | null
  liquidation_rank: number | null
  current_nav?: number | null
  management_fee?: number | null
  carried_interest?: number | null
  preferred_return?: number | null
  notes: string | null
  created_at: number
  _share_class_fee?: ShareClassFee[] | null
}

export type CapTableShEntry = {
  id: string
  committed_amount?: number | null
  _capital_call?: CapitalCall[]
}

export type CapTableFundChild = {
  id: string
  entity: string
  name?: string | null
  email?: string | null
  _entity?: { id: string; _fund?: { name?: string | null } | null } | null
  _cap_table_entry?: CapTableShEntry[] | null
}

export type CapTableShareholder = {
  id: string
  entity: string
  name: string | null
  type: "individual" | "company" | null
  role: "ubo" | "stakeholder" | "investor" | null
  is_ubo: boolean | null
  ubo_percentage: number | null
  country: number | null
  id_number: string | null
  user: number | null
  email: string | null
  invited_at: number | null
  invite_sent: boolean | null
  accepted: boolean | null
  accepted_at: number | null
  rejected: boolean | null
  notes: string | null
  parent_shareholder?: string | null
  created_at: number
  _cap_table_entry?: CapTableShEntry[] | null
  _parent_shareholder?: CapTableFundChild[] | null
}

export type CapTableEntry = {
  id: string
  entity: string
  shareholder: string | null
  share_class: string | null
  round_label: string | null
  shares_issued: number | null
  price_per_share: number | null
  committed_amount: number | null
  issued_at: number | null
  notes: string | null
  created_at: number
  _capital_call?: CapitalCall[] | null
  _shareholder?: { id: string; name?: string | null; email?: string | null; type?: string | null; parent_shareholder?: string | null } | null
}

export type CapitalCallEntityAddon = {
  id: string
  type?: string | null
  _fund?: { name?: string | null } | null
  _company?: { name?: string | null } | null
  _family_office?: { name?: string | null } | null
}

export type CapitalCall = {
  id: string
  entity: string
  cap_table_entry: string | null
  amount: number | null
  called_at: number | null
  due_date: number | null
  status: "pending" | "partial" | "paid" | null
  notes: string | null
  notified_at: number | null
  acknowledged_at: number | null
  received_at: number | null
  deployed_at: number | null
  created_at: number
  share_class?: string | null
  _entity?: CapitalCallEntityAddon | null
  _share_class?: { id: string; name?: string | null; current_nav?: number | null } | null
  _cap_table_entry?: {
    id: string
    shareholder?: string | null
    committed_amount?: number | null
    _shareholder?: { id: string; name?: string | null; email?: string | null } | null
  } | null
}

export async function fetchShareClasses(entityUUID: string): Promise<ShareClass[]> {
  const res = await fetch(`/api/share-classes?entity=${entityUUID}`, { cache: "no-store" })
  if (!res.ok) return []
  return res.json()
}

export async function fetchCapTableShareholders(entityUUID: string): Promise<CapTableShareholder[]> {
  const res = await fetch(`/api/cap-table-shareholders?entity=${entityUUID}`, { cache: "no-store" })
  if (!res.ok) return []
  return res.json()
}

export async function fetchCapTableEntries(entityUUID: string): Promise<CapTableEntry[]> {
  const res = await fetch(`/api/cap-table-entries?entity=${entityUUID}`, { cache: "no-store" })
  if (!res.ok) return []
  return res.json()
}

export async function fetchCapitalCalls(entityUUID: string): Promise<CapitalCall[]> {
  const res = await fetch(`/api/capital-calls?entity=${entityUUID}`, { cache: "no-store" })
  if (!res.ok) return []
  return res.json()
}
