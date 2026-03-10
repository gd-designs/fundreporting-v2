import type { Asset } from "@/lib/types"

export type CreateAssetInput = {
  entity: string
  name: string
  description?: string
  currency?: string
  asset_class?: string
  amount?: string
  quantity?: string
  cost?: string
  investable?: string
  taxable?: string
  purchasedAt?: string
  notes?: string
}

export async function getAssets(entityUUID: string): Promise<Asset[]> {
  const res = await fetch(`/api/assets?entity=${entityUUID}`)
  if (!res.ok) throw new Error("Failed to fetch assets")
  return res.json()
}

export async function createAsset(data: CreateAssetInput): Promise<Asset> {
  const res = await fetch("/api/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(err.error ?? "Failed to create asset")
  }
  return res.json()
}

export async function updateAsset(id: string, data: Partial<CreateAssetInput>): Promise<Asset> {
  const res = await fetch(`/api/assets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(err.error ?? "Failed to update asset")
  }
  return res.json()
}

export async function deleteAsset(id: string): Promise<void> {
  const res = await fetch(`/api/assets/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete asset")
}

export function formatAmount(amount: number | null, currencyCode: string): string {
  if (amount === null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount)
}
