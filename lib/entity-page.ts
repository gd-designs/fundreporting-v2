import { getAuthToken } from '@/lib/auth'
import type { Asset } from '@/lib/types'

const SLUG_TO_ENDPOINT: Record<string, string> = {
  portfolio: 'portfolio',
  company: 'company',
  fund: 'fund',
  'family-office': 'family_office',
  'asset-manager': 'asset_manager',
}

/**
 * Fetches the sub-table record (portfolio, company, etc.) by id.
 * Returns null if not found or unauthorized.
 */
export async function getEntityRecord(slug: string, id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const endpoint = SLUG_TO_ENDPOINT[slug]
  if (!endpoint) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/${endpoint}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json() as Promise<{ id: string; entity: string; name: string | null; [key: string]: unknown }>
}

/**
 * Fetches all assets belonging to a given base entity UUID.
 */
export async function getAssetsForEntity(entityUUID: string) {
  const token = await getAuthToken()
  if (!token) return []
  const res = await fetch(`${process.env.PLATFORM_API_URL}/asset`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const all = await res.json() as Asset[]
  return all.filter(a => a.entity === entityUUID)
}
