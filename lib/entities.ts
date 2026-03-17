import { getAuthToken } from '@/lib/auth'
import type { EntityType, UnifiedEntity } from '@/lib/types'

export async function getEntities(): Promise<UnifiedEntity[]> {
  const token = await getAuthToken()
  if (!token) return []

  const headers = { Authorization: `Bearer ${token}` }
  const base = process.env.PLATFORM_API_URL

  try {
    const res = await fetch(`${base}/entity`, { headers, cache: 'no-store' })
    if (!res.ok) return []

    const entities = await res.json() as Array<Record<string, unknown>>

    // Deduplicate: same entity can appear multiple times (owner + shareholder + team_member rows).
    // Keep first occurrence; dedup is handled server-side via JS lambda merging _access arrays.
    const seen = new Map<string, Record<string, unknown>>()
    for (const e of entities) {
      const eid = e.id as string
      if (!seen.has(eid)) seen.set(eid, e)
    }
    const deduped = Array.from(seen.values())

    return deduped
      .filter((e) => e.type !== "fund")
      .map((e) => {
        const type = e.type as EntityType
        const sub = e[`_${type}`] as Record<string, unknown> | null | undefined
        if (!sub) return null
        const countryAddon = sub._country as { id: number; name?: string; code?: string } | null | undefined
        return {
          ...sub,
          id: sub.id as string,
          entity: e.id as string,
          type,
          created_at: e.created_at as string,
          country: countryAddon?.name ?? sub.country ?? undefined,
          _access: (e._access as UnifiedEntity["_access"]) ?? null,
        } as UnifiedEntity
      })
      .filter((e): e is UnifiedEntity => e !== null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } catch {
    return []
  }
}
