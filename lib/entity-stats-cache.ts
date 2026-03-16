export type CachedEntityStats = {
  assetsValue: number
  liabilitiesValue: number
  assetsCount: number
  cachedAt: number
}

// Process-level cache — survives HMR in dev via globalThis singleton.
// Resets on server restart but repopulates as users navigate entity pages.
const CACHE_KEY = '__entity_stats_cache__'
if (!(CACHE_KEY in globalThis)) {
  ;(globalThis as Record<string, unknown>)[CACHE_KEY] = new Map<string, CachedEntityStats>()
}
const statsCache = (globalThis as Record<string, unknown>)[CACHE_KEY] as Map<string, CachedEntityStats>

export function getCachedEntityStats(entityId: string): CachedEntityStats | null {
  return statsCache.get(entityId) ?? null
}

export function setCachedEntityStats(entityId: string, stats: Partial<Omit<CachedEntityStats, 'cachedAt'>>) {
  const existing = statsCache.get(entityId) ?? { assetsValue: 0, liabilitiesValue: 0, assetsCount: 0, cachedAt: 0 }
  statsCache.set(entityId, { ...existing, ...stats, cachedAt: Date.now() })
}
