"use client"

export type Mutation = {
  id: string
  assetId: string
  entityId: string
  date: number
  delta: number
  source: "return_profile" | "transaction" | null
  sourceId: string | null
  notes: string | null
  createdAt: number
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : ""
}
function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") { const n = Number(v); if (Number.isFinite(n)) return n }
  return 0
}

const SOURCES = ["return_profile", "transaction"]

function mapMutation(raw: unknown): Mutation | null {
  if (!raw || typeof raw !== "object") return null
  const m = raw as Record<string, unknown>
  if (typeof m.id !== "string") return null
  return {
    id: m.id,
    assetId: toStr(m.asset),
    entityId: toStr(m.entity),
    date: toNum(m.date),
    delta: toNum(m.delta),
    source: SOURCES.includes(m.source as string) ? (m.source as Mutation["source"]) : null,
    sourceId: typeof m.source_id === "string" ? m.source_id : null,
    notes: typeof m.notes === "string" ? m.notes : null,
    createdAt: toNum(m.created_at),
  }
}

export async function fetchEntityMutations(entityId: string): Promise<Mutation[]> {
  try {
    const res = await fetch(`/api/mutations?entity=${encodeURIComponent(entityId)}`, { cache: "no-store" })
    if (!res.ok) return []
    const data = await res.json() as unknown[]
    return data.map(mapMutation).filter((m): m is Mutation => m !== null)
  } catch {
    return []
  }
}

export async function fetchMutations(assetId: string, entityId: string): Promise<Mutation[]> {
  try {
    const res = await fetch(
      `/api/mutations?asset=${encodeURIComponent(assetId)}&entity=${encodeURIComponent(entityId)}`,
      { cache: "no-store" }
    )
    if (!res.ok) return []
    const data = await res.json() as unknown[]
    return data.map(mapMutation).filter((m): m is Mutation => m !== null)
  } catch {
    return []
  }
}

export async function createMutation(input: {
  entity: string
  asset: string
  date: number
  delta: number
  source?: Mutation["source"]
  source_id?: string
  notes?: string
}): Promise<Mutation> {
  const res = await fetch("/api/mutations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json() as unknown
  const m = mapMutation(data)
  if (!m) throw new Error("Invalid mutation response")
  return m
}
