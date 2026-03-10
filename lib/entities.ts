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

    return entities
      .filter((e) => e.type !== "fund")
      .map((e) => {
        const type = e.type as EntityType
        const sub = e[`_${type}`] as Record<string, unknown> | null | undefined
        if (!sub) return null
        return {
          ...sub,
          id: sub.id as string,
          entity: e.id as string,
          type,
          created_at: e.created_at as string,
        } as UnifiedEntity
      })
      .filter((e): e is UnifiedEntity => e !== null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } catch {
    return []
  }
}
