"use client"

export const ENTITY_ASSETS_CHANGED_EVENT = "entity-assets-changed"

export type EntityAsset = {
  id: string
  entityId: string
  name: string
  description: string
  order: number | null
  investable: "investable_cash" | "investable_convert" | "non_investable" | "equity_stake" | null
  capTableShareholder: string | null
  taxable: "taxable" | "tax_deferred" | "tax_free" | null
  notes: string | null
  countryId: number | null
  countryLabel: string
  currencyId: number | null
  currencyCode: string
  currencyLabel: string
  classId: number | null
  className: string
  createdAt: string
  purchasedAt: string | null
  archived: boolean
  locked: boolean
  instrument: {
    id: string
    ticker: string
    name: string
    exchange: string
    type: string
  } | null
  liabilities: Array<{
    id: string
    name: string | null
    reference: string | null
    loan_amount: number | null
    interest_rate: number | null
    frequency: string | null
    term_length: number | null
    scheme: string | null
    date: number | null
  }>
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : ""
}

export function mapXanoAsset(raw: unknown): EntityAsset | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  if (typeof item.id !== "string") return null

  const currency = item._currency as Record<string, unknown> | undefined
  const country = item._country as Record<string, unknown> | undefined
  const assetClass = (item._asset_class ?? item._class) as Record<string, unknown> | undefined
  const instr = item._instrument as Record<string, unknown> | undefined

  const createdAtRaw = toNum(item.created_at)
  const createdAt = createdAtRaw ? new Date(createdAtRaw).toISOString() : new Date().toISOString()

  return {
    id: item.id,
    entityId: toStr(item.entity),
    name: toStr(item.name),
    description: toStr(item.description),
    order: toNum(item.order),
    investable:
      item.investable === "investable_cash" ||
      item.investable === "investable_convert" ||
      item.investable === "non_investable" ||
      item.investable === "equity_stake"
        ? item.investable
        : null,
    capTableShareholder: typeof item.cap_table_shareholder === "string" && item.cap_table_shareholder ? item.cap_table_shareholder : null,
    taxable:
      item.taxable === "taxable" ||
      item.taxable === "tax_deferred" ||
      item.taxable === "tax_free"
        ? item.taxable
        : null,
    notes: typeof item.notes === "string" ? item.notes : null,
    countryId: toNum(item.country),
    countryLabel: toStr(country?.name),
    currencyId: toNum(item.currency),
    currencyCode: toStr(currency?.code) || "EUR",
    currencyLabel: toStr(currency?.name) || "Euro",
    classId: toNum(item.asset_class),
    className: toStr(assetClass?.name),
    createdAt,
    archived: item.archived === true,
    locked: item.locked === true,
    purchasedAt: (() => {
      const raw = toNum(item.purchased_at) ?? toNum(item.purchasedAt)
      return raw ? new Date(raw).toISOString() : null
    })(),
    instrument:
      instr && typeof instr.id === "string"
        ? {
            id: instr.id,
            ticker: toStr(instr.ticker),
            name: toStr(instr.name),
            exchange: toStr(instr.exchange),
            type: toStr(instr.type),
          }
        : null,
    liabilities: (() => {
      const raw = item._liability
      const arr = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : []
      return arr
        .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
        .map((l) => ({
          id: toStr(l.id),
          name: typeof l.name === "string" ? l.name : null,
          reference: typeof l.reference === "string" ? l.reference : null,
          loan_amount: toNum(l.loan_amount),
          interest_rate: toNum(l.interest_rate),
          frequency: typeof l.frequency === "string" ? l.frequency : null,
          term_length: toNum(l.term_length),
          scheme: typeof l.scheme === "string" ? l.scheme : null,
          date: toNum(l.date),
        }))
    })(),
  }
}

export async function fetchEntityAssets(entityId: string): Promise<EntityAsset[]> {
  const res = await fetch(`/api/assets?entity=${encodeURIComponent(entityId)}`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load assets.")
  const raw = (await res.json()) as unknown[]
  return (Array.isArray(raw) ? raw : [])
    .map(mapXanoAsset)
    .filter((a): a is EntityAsset => !!a)
    .sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER
      const bo = b.order ?? Number.MAX_SAFE_INTEGER
      if (ao !== bo) return ao - bo
      return Date.parse(a.createdAt) - Date.parse(b.createdAt)
    })
}

export async function deleteEntityAsset(assetId: string): Promise<void> {
  const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE", cache: "no-store" })
  if (!res.ok && res.status !== 204) {
    const payload = (await res.json()) as { message?: string }
    throw new Error(payload.message ?? "Failed to delete asset.")
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ENTITY_ASSETS_CHANGED_EVENT, { detail: { assetId } }))
  }
}

export async function updateEntityAsset(assetId: string, input: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/assets/${assetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  })
  if (!res.ok) {
    const payload = (await res.json()) as { message?: string }
    throw new Error(payload.message ?? "Failed to update asset.")
  }
}

export function formatCurrency(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currencyCode.toUpperCase()} ${amount.toFixed(2)}`
  }
}
