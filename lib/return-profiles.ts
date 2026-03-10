"use client"

export type ReturnProfileType = "cash_flow" | "compounding"
export type ReturnProfileFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "bi-annually" | "annually"
export type ReturnProfileMethod = "simple" | "compound"

export type ReturnProfile = {
  id: string
  assetId: string
  name: string | null
  description: string | null
  type: ReturnProfileType | null
  frequency: ReturnProfileFrequency | null
  amount: number | null
  rate: number | null
  currencyId: number | null
  method: ReturnProfileMethod | null
  start: number | null
  end: number | null
  collection: number | null
  createdAt: number
}

const TYPES: ReturnProfileType[] = ["cash_flow", "compounding"]
const FREQUENCIES: ReturnProfileFrequency[] = ["daily", "weekly", "monthly", "quarterly", "bi-annually", "annually"]
const METHODS: ReturnProfileMethod[] = ["simple", "compound"]

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") { const n = Number(v); if (Number.isFinite(n)) return n }
  return null
}

function mapReturnProfile(raw: unknown): ReturnProfile | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== "string") return null
  return {
    id: r.id,
    assetId: typeof r.asset === "string" ? r.asset : "",
    name: typeof r.name === "string" ? r.name : null,
    description: typeof r.description === "string" ? r.description : null,
    type: TYPES.includes(r.type as ReturnProfileType) ? (r.type as ReturnProfileType) : null,
    frequency: FREQUENCIES.includes(r.frequency as ReturnProfileFrequency) ? (r.frequency as ReturnProfileFrequency) : null,
    amount: toNum(r.amount),
    rate: toNum(r.rate),
    currencyId: typeof r.currency === "number" ? r.currency : null,
    method: METHODS.includes(r.method as ReturnProfileMethod) ? (r.method as ReturnProfileMethod) : null,
    start: toNum(r.start),
    end: toNum(r.end),
    collection: toNum(r.collection),
    createdAt: toNum(r.created_at) ?? 0,
  }
}

export async function fetchReturnProfiles(assetId: string): Promise<ReturnProfile[]> {
  try {
    const res = await fetch(`/api/return-profiles?asset=${encodeURIComponent(assetId)}`, { cache: "no-store" })
    if (!res.ok) return []
    const data = await res.json() as unknown[]
    return data.map(mapReturnProfile).filter((p): p is ReturnProfile => p !== null)
  } catch {
    return []
  }
}

export async function createReturnProfile(input: {
  asset: string
  name?: string
  description?: string
  type?: ReturnProfileType
  frequency?: ReturnProfileFrequency
  amount?: number
  rate?: number
  currency?: number
  method?: ReturnProfileMethod
  start?: number
  end?: number
  collection?: number
}): Promise<ReturnProfile> {
  const res = await fetch("/api/return-profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json() as unknown
  const p = mapReturnProfile(data)
  if (!p) throw new Error("Invalid return profile response")
  return p
}

export async function deleteReturnProfile(id: string): Promise<void> {
  const res = await fetch(`/api/return-profiles/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error(await res.text())
}
