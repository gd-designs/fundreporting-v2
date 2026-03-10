"use client"

export type TransactionLeg = {
  id: string
  createdAt: number | null
  entryType: string
  entryTypeLabel: string
  objectType: string | null
  objectId: string | null
  objectName: string | null
  direction: "in" | "out"
  amount: number
  currencyCode: string | null
  units: number | null
  pricePerUnit: number | null
  proceeds: number | null
  cost: number | null
  assetId: string
  assetName: string
  entityId: string
  entityName: string
  source: string | null
  sourceId: string | null
}

export type EntityTransaction = {
  id: string
  reference: string
  typeName: string
  typeId: number
  date: number
  notes: string | null
  legs: TransactionLeg[]
}

/**
 * Transaction type names that represent capital deployment or disposal.
 * Only these count toward net capital deployed, txOutTotal, and "sold" detection.
 * Add new capital transaction types here as they are created in the platform.
 * Everything else (income, expense, fee, dividend, distribution, revaluation…)
 * is excluded automatically.
 */
export const CAPITAL_TX_TYPE_NAMES = new Set([
  "buy",
  "sell",
  "sale",
  "transfer in",
  "transfer out",
])

export function isCapitalTransaction(tx: EntityTransaction): boolean {
  return CAPITAL_TX_TYPE_NAMES.has(tx.typeName.toLowerCase().trim())
}

function toEntryTypeLabel(value: string): string {
  if (!value) return ""
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ")
}

export function mapRawEntriesToTransactions(rawEntries: unknown[]): EntityTransaction[] {
  const txMap = new Map<string, EntityTransaction>()

  for (const raw of rawEntries) {
    if (!raw || typeof raw !== "object") continue
    const item = raw as Record<string, unknown>
    if (typeof item.id !== "string") continue

    const tx = item._transaction as Record<string, unknown> | undefined
    if (!tx || typeof tx.id !== "string") continue
    const txId = tx.id

    if (!txMap.has(txId)) {
      const txType = (item._transaction_type ?? tx._type) as Record<string, unknown> | undefined
      txMap.set(txId, {
        id: txId,
        reference: typeof tx.reference === "string" ? tx.reference : "",
        typeName: typeof txType?.name === "string" ? txType.name : "",
        typeId: typeof tx.type === "number" ? tx.type : 0,
        date: typeof tx.date === "number" ? tx.date : 0,
        notes: typeof tx.notes === "string" ? tx.notes : null,
        legs: [],
      })
    }

    const asset = item._asset as Record<string, unknown> | undefined
    const entryEntity = item._entity as Record<string, unknown> | undefined
    const entryCurrency = item._currency as Record<string, unknown> | undefined
    const assetCurrency = asset?._currency as Record<string, unknown> | undefined
    const legEntryType =
      typeof item.entry_type === "string" ? item.entry_type.trim().toLowerCase() : ""
    const resolvedCurrencyCode =
      typeof entryCurrency?.code === "string"
        ? entryCurrency.code
        : typeof assetCurrency?.code === "string"
          ? assetCurrency.code
          : null

    const objectType =
      typeof item.object_type === "string" ? item.object_type.trim().toLowerCase() : null
    const objectId = typeof item.object_id === "string" ? item.object_id : null
    const resolvedAssetId =
      typeof item.asset === "string"
        ? item.asset
        : objectType === "asset" && objectId
          ? objectId
          : ""
    const resolvedObjectName =
      typeof asset?.name === "string" ? asset.name : null

    txMap.get(txId)!.legs.push({
      id: item.id,
      createdAt: typeof item.created_at === "number" ? item.created_at : null,
      entryType: legEntryType,
      entryTypeLabel: toEntryTypeLabel(legEntryType),
      objectType,
      objectId,
      objectName: resolvedObjectName,
      direction: item.direction === "out" ? "out" : "in",
      amount: typeof item.amount === "number" ? item.amount : 0,
      currencyCode: resolvedCurrencyCode,
      units: typeof item.units === "number" ? item.units : null,
      pricePerUnit: typeof item.price_per_unit === "number" ? item.price_per_unit : null,
      proceeds: typeof item.proceeds === "number" ? item.proceeds : null,
      cost: typeof item.cost === "number" ? item.cost : null,
      assetId: resolvedAssetId,
      assetName: typeof asset?.name === "string" ? asset.name : "",
      entityId: typeof item.entity === "string" ? item.entity : "",
      entityName: typeof entryEntity?.name === "string" ? entryEntity.name : "",
      source: typeof item.source === "string" ? item.source : null,
      sourceId: typeof item.source_id === "string" ? item.source_id : null,
    })
  }

  return Array.from(txMap.values()).sort((a, b) => b.date - a.date)
}

export async function fetchEntityTransactions(entityId: string): Promise<EntityTransaction[]> {
  const res = await fetch(
    `/api/transaction-entries?entity=${encodeURIComponent(entityId)}`,
    { cache: "no-store" },
  )
  const payload = (await res.json()) as { entries?: unknown; message?: string }
  if (!res.ok) throw new Error(payload.message ?? "Failed to load transactions.")
  const rawEntries = Array.isArray(payload.entries) ? payload.entries : []
  const filtered = rawEntries.filter((entry) => {
    if (!entry || typeof entry !== "object") return false
    return (entry as Record<string, unknown>).entity === entityId
  })
  return mapRawEntriesToTransactions(filtered)
}

export function formatTxDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp))
}

export function formatAmountWithCurrency(amount: number, currencyCode: string | null): string {
  if (currencyCode && /^[A-Z]{3}$/.test(currencyCode)) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
