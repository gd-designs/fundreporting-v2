import type { DashboardSnapshot, Document, EntityType, Task, UnifiedEntity } from '@/lib/types'
import { getCachedEntityStats } from '@/lib/entity-stats-cache'

const TYPE_SLUGS: Record<EntityType, string> = {
  portfolio: 'portfolio',
  company: 'company',
  fund: 'fund',
  family_office: 'family-office',
  asset_manager: 'asset-manager',
}

type EntityFinancials = {
  entityId: string
  assetCount: number
  netValue: number   // tx entries sum + mutation deltas (book value, no live prices)
  debts: number      // sum of loan_amount from liabilities
}

async function fetchEntityFinancials(
  base: string,
  headers: Record<string, string>,
  entityId: string
): Promise<EntityFinancials> {
  const enc = encodeURIComponent(entityId)

  const [assetsData, entriesData, mutationsData, liabilitiesData] = await Promise.all([
    fetch(`${base}/asset?entity=${enc}`, { headers, cache: 'no-store' })
      .then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(`${base}/transaction_entry?entity=${enc}`, { headers, cache: 'no-store' })
      .then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(`${base}/mutation?entity=${enc}`, { headers, cache: 'no-store' })
      .then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(`${base}/liability?entity=${enc}`, { headers, cache: 'no-store' })
      .then(r => r.ok ? r.json() : []).catch(() => []),
  ])

  const assetCount = Array.isArray(assetsData) ? (assetsData as unknown[]).length : 0

  // Build asset balances from transaction entries
  const balances = new Map<string, number>()
  if (Array.isArray(entriesData)) {
    for (const e of entriesData as Record<string, unknown>[]) {
      const assetId =
        typeof e.asset === 'string' && e.asset
          ? e.asset
          : e.object_type === 'asset' && typeof e.object_id === 'string'
            ? e.object_id
            : null
      if (!assetId) continue
      const dir = e.direction === 'in' ? 1 : -1
      const amount = typeof e.amount === 'number' ? e.amount : 0
      balances.set(assetId, (balances.get(assetId) ?? 0) + dir * amount)
    }
  }

  // Apply mutation deltas
  if (Array.isArray(mutationsData)) {
    for (const m of mutationsData as Record<string, unknown>[]) {
      const assetId = typeof m.asset === 'string' ? m.asset : null
      const delta = typeof m.delta === 'number' ? m.delta : 0
      if (assetId) balances.set(assetId, (balances.get(assetId) ?? 0) + delta)
    }
  }

  const netValue = Array.from(balances.values()).reduce((s, v) => s + v, 0)

  // Sum liability principal amounts
  const debts = Array.isArray(liabilitiesData)
    ? (liabilitiesData as Record<string, unknown>[]).reduce(
        (s, l) => s + (typeof l.loan_amount === 'number' ? l.loan_amount : 0),
        0
      )
    : 0

  return { entityId, assetCount, netValue, debts }
}

export async function buildDashboardSnapshot(
  token: string,
  entities: UnifiedEntity[]
): Promise<DashboardSnapshot> {
  const headers = { Authorization: `Bearer ${token}` }
  const base = process.env.PLATFORM_API_URL

  let tasks: Task[] = []
  let documents: Document[] = []

  const [tasksRes, docsRes, ...financialResults] = await Promise.allSettled([
    fetch(`${base}/task`, { headers, cache: 'no-store' }),
    fetch(`${base}/document`, { headers, cache: 'no-store' }),
    ...entities.map(e => fetchEntityFinancials(base!, headers, e.entity)),
  ])

  if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
    const data = await tasksRes.value.json()
    if (Array.isArray(data)) tasks = data
  }
  if (docsRes.status === 'fulfilled' && docsRes.value.ok) {
    const data = await docsRes.value.json()
    if (Array.isArray(data)) documents = data
  }

  const financialsMap = new Map<string, EntityFinancials>()
  for (const result of financialResults) {
    if (result.status === 'fulfilled') {
      const f = result.value as EntityFinancials
      financialsMap.set(f.entityId, f)
    }
  }

  const openTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled')

  const entitySnapshots = entities.map(entity => {
    const cached = getCachedEntityStats(entity.entity)
    const f = financialsMap.get(entity.entity)
    const entityTasksOpen = openTasks.filter(t => t.entity === entity.entity).length

    const assetsValue = cached?.assetsValue ?? f?.netValue ?? 0
    const liabilitiesValue = cached?.liabilitiesValue ?? f?.debts ?? 0
    return {
      entity,
      // Prefer cached stats (exact, with live prices) over book-value fallback
      assetsValue,
      netValue: assetsValue - liabilitiesValue,
      assetsCount: cached?.assetsCount ?? f?.assetCount ?? 0,
      liabilitiesValue,
      tasksOpen: entityTasksOpen,
      href: `/${TYPE_SLUGS[entity.type]}/${entity.id}`,
    }
  })

  // Sort documents newest-first
  const sortedDocs = [...documents].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))

  const portfolioSnapshots = entitySnapshots.filter(e => e.entity.type === 'portfolio')
  const totalAssetsValue = portfolioSnapshots.reduce((s, e) => s + e.assetsValue, 0)
  const totalDebts = portfolioSnapshots.reduce((s, e) => s + e.liabilitiesValue, 0)

  return {
    entitySnapshots,
    tasks: openTasks,
    documents: sortedDocs,
    totals: {
      entities: entities.length,
      portfolios: entities.filter(e => e.type === 'portfolio').length,
      companies: entities.filter(e => e.type === 'company').length,
      assetsValue: totalAssetsValue,
      liabilitiesValue: totalDebts,
      netValue: totalAssetsValue - totalDebts,
      openTasks: openTasks.length,
      documents: documents.length,
    },
  }
}
