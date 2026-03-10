import type { Asset, DashboardSnapshot, EntityType, UnifiedEntity } from '@/lib/types'

const TYPE_SLUGS: Record<EntityType, string> = {
  portfolio: 'portfolio',
  company: 'company',
  fund: 'fund',
  family_office: 'family-office',
  asset_manager: 'asset-manager',
}

export async function buildDashboardSnapshot(
  token: string,
  entities: UnifiedEntity[]
): Promise<DashboardSnapshot> {
  const headers = { Authorization: `Bearer ${token}` }
  const base = process.env.PLATFORM_API_URL

  let assets: Asset[] = []
  try {
    const res = await fetch(`${base}/asset`, { headers, cache: 'no-store' })
    if (res.ok) assets = await res.json()
  } catch {
    // assets stays []
  }

  const entitySnapshots = entities.map(entity => {
    const entityAssets = assets.filter(a => a.entity === entity.entity)
    const assetsValue = entityAssets.reduce((sum, a) => sum + (a.amount ?? 0), 0)

    return {
      entity,
      netValue: assetsValue,
      assetsCount: entityAssets.length,
      liabilitiesValue: 0,
      tasksOpen: 0,
      href: `/${TYPE_SLUGS[entity.type]}/${entity.id}`,
    }
  })

  const assetsValue = assets.reduce((sum, a) => sum + (a.amount ?? 0), 0)

  return {
    entitySnapshots,
    tasks: [],
    documents: [],
    totals: {
      entities: entities.length,
      portfolios: entities.filter(e => e.type === 'portfolio').length,
      companies: entities.filter(e => e.type === 'company').length,
      assetsValue,
      liabilitiesValue: 0,
      netValue: assetsValue,
      openTasks: 0,
      documents: 0,
    },
  }
}
