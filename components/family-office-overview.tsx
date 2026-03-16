"use client"

import * as React from "react"
import { Landmark } from "lucide-react"
import { fetchEntityAssets, type EntityAsset } from "@/lib/entity-assets"
import { fetchEntityLiabilities, type Liability } from "@/lib/liabilities"
import { computeAll, type PaymentScheme } from "@/lib/amortization"
import { formatAmountWithCurrency } from "@/lib/entity-transactions"
import { fetchMarketQuote } from "@/lib/market"
import { PortfolioTrendChart } from "@/components/portfolio-trend-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { UnifiedEntity } from "@/lib/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FoPortfolioLink = {
  id: string
  family_office: string
  portfolio: string
  label: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOutstanding(l: Liability, paidCount: number): number {
  const p = l.loan_amount ?? 0
  if (paidCount === 0 || !l.interest_rate || !l.term_length || !l.frequency || !l.scheme) return p
  const periods = computeAll(p, l.interest_rate, l.frequency, l.term_length)[l.scheme as PaymentScheme]
  return periods[Math.min(paidCount, l.term_length) - 1]?.closing ?? p
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FamilyOfficeOverview({
  entityUUID,
  familyOfficeId,
  familyOfficeName,
  country,
  allPortfolios,
}: {
  entityUUID: string
  familyOfficeId: string
  familyOfficeName: string | null
  country?: string | null
  allPortfolios: UnifiedEntity[]
}) {
  const [assets, setAssets] = React.useState<EntityAsset[]>([])
  const [liabilities, setLiabilities] = React.useState<Liability[]>([])
  const [assetBalances, setAssetBalances] = React.useState<Map<string, number>>(new Map())
  const [paidMap, setPaidMap] = React.useState<Map<string, number>>(new Map())
  const [trendData, setTrendData] = React.useState<{ label: string; value: number }[]>([])
  const [loading, setLoading] = React.useState(true)
  const [noPortfolios, setNoPortfolios] = React.useState(false)
  const [currencyCode, setCurrencyCode] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // 1. Fetch portfolio links
        const linksRes = await fetch(`/api/family-office-portfolios?family_office=${familyOfficeId}`)
        const links: FoPortfolioLink[] = linksRes.ok ? await linksRes.json() : []

        if (links.length === 0) {
          setNoPortfolios(true)
          setLoading(false)
          return
        }
        setNoPortfolios(false)

        const portfolioById = new Map(allPortfolios.map((p) => [p.id, p]))

        // 2. Load data for each portfolio entity in parallel
        const portfolioData = await Promise.all(
          links.map(async (link) => {
            const portfolio = portfolioById.get(link.portfolio)
            const entityId = portfolio?.entity ?? ""
            if (!entityId) return null

            const [assetList, liabilityList, entriesPayload, mutationsData] = await Promise.all([
              fetchEntityAssets(entityId).catch(() => [] as EntityAsset[]),
              fetchEntityLiabilities(entityId).catch(() => [] as Liability[]),
              fetch(`/api/transaction-entries?entity=${entityId}`)
                .then((r) => r.ok ? r.json() : { entries: [] })
                .catch(() => ({ entries: [] })),
              fetch(`/api/mutations?entity=${entityId}`)
                .then((r) => r.ok ? (r.json() as Promise<Array<Record<string, unknown>>>) : Promise.resolve([]))
                .catch(() => [] as Array<Record<string, unknown>>),
            ])

            return { entityId, assetList, liabilityList, entriesPayload, mutationsData }
          })
        )

        // 3. Aggregate across all portfolios
        const allAssets: EntityAsset[] = []
        const allLiabilities: Liability[] = []
        const balances = new Map<string, number>()
        const unitBalances = new Map<string, number>()
        const pm = new Map<string, number>()
        const txPoints: { date: number; assetId: string; delta: number }[] = []

        for (const data of portfolioData) {
          if (!data) continue
          const { assetList, liabilityList, entriesPayload, mutationsData } = data

          allAssets.push(...assetList)
          allLiabilities.push(...liabilityList)

          const rawEntries = Array.isArray(
            (entriesPayload as { entries?: unknown[] }).entries,
          )
            ? (entriesPayload as { entries: Record<string, unknown>[] }).entries
            : []

          for (const e of rawEntries) {
            const objType = typeof e.object_type === "string" ? e.object_type : null
            const objId = typeof e.object_id === "string" ? e.object_id : null
            const direction = e.direction as string | undefined
            const amount = typeof e.amount === "number" ? e.amount : 0
            const units = typeof e.units === "number" ? e.units : null
            const entryType = typeof e.entry_type === "string" ? e.entry_type : null
            const dir = direction === "in" ? 1 : -1

            const assetId =
              typeof e.asset === "string" && e.asset
                ? e.asset
                : objType === "asset" && objId
                  ? objId
                  : null

            if (assetId) {
              balances.set(assetId, (balances.get(assetId) ?? 0) + dir * amount)
              if (units !== null) {
                unitBalances.set(assetId, (unitBalances.get(assetId) ?? 0) + dir * units)
              }
              const tx = e._transaction as Record<string, unknown> | undefined
              const txDate = tx && typeof tx.date === "number" ? tx.date : null
              if (txDate) {
                txPoints.push({ date: txDate, assetId, delta: dir * amount })
              }
            }

            if (objType === "liability" && objId && entryType === "principal" && direction === "out") {
              pm.set(objId, (pm.get(objId) ?? 0) + 1)
            }
          }

          for (const m of mutationsData) {
            const assetId = typeof m.asset === "string" ? m.asset : null
            const delta = typeof m.delta === "number" ? m.delta : 0
            if (assetId) balances.set(assetId, (balances.get(assetId) ?? 0) + delta)
          }
        }

        // 4. Fetch live quotes for ticker assets
        const tickerByAsset = new Map<string, string>()
        for (const asset of allAssets) {
          const ticker = asset.instrument?.ticker?.trim().toUpperCase()
          if (ticker) tickerByAsset.set(asset.id, ticker)
        }
        const uniqueTickers = Array.from(new Set(tickerByAsset.values()))
        if (uniqueTickers.length > 0) {
          await Promise.all(
            uniqueTickers.map(async (ticker) => {
              try {
                const q = await fetchMarketQuote(ticker)
                if (typeof q.price === "number" && q.price > 0) {
                  for (const [assetId, t] of tickerByAsset) {
                    if (t === ticker) {
                      const units = unitBalances.get(assetId) ?? 0
                      balances.set(assetId, units > 0 ? units * q.price : 0)
                    }
                  }
                }
              } catch { /* ignore */ }
            })
          )
        }

        setAssets(allAssets)
        setLiabilities(allLiabilities)
        setAssetBalances(balances)
        setPaidMap(pm)
        setCurrencyCode(allAssets.find((a) => a.currencyCode)?.currencyCode ?? null)

        // 5. Build trend chart
        txPoints.sort((a, b) => a.date - b.date)
        if (txPoints.length > 0) {
          let cumulative = 0
          const points: { label: string; value: number }[] = [{ label: "Start", value: 0 }]
          for (const pt of txPoints) {
            cumulative += pt.delta
            const label = new Date(pt.date).toLocaleDateString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
            })
            const last = points[points.length - 1]
            if (last.label === label) {
              last.value = cumulative
            } else {
              points.push({ label, value: cumulative })
            }
          }
          setTrendData(points)
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [familyOfficeId, allPortfolios]) // eslint-disable-line react-hooks/exhaustive-deps

  const netAssets = React.useMemo(
    () => Array.from(assetBalances.values()).reduce((s, v) => s + v, 0),
    [assetBalances],
  )
  const debts = React.useMemo(
    () => liabilities.reduce((s, l) => s + getOutstanding(l, paidMap.get(l.id) ?? 0), 0),
    [liabilities, paidMap],
  )

  // Write aggregated stats to server cache for dashboard entity cards
  React.useEffect(() => {
    if (loading || assetBalances.size === 0) return
    fetch(`/api/entity-stats/${entityUUID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetsValue: netAssets, liabilitiesValue: debts, assetsCount: assets.length }),
    }).catch(() => {})
  }, [loading, entityUUID, netAssets, debts, assets.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const cashOnHand = React.useMemo(
    () =>
      assets
        .filter((a) => a.investable === "investable_cash")
        .reduce((s, a) => s + (assetBalances.get(a.id) ?? 0), 0),
    [assets, assetBalances],
  )
  const investable = React.useMemo(
    () =>
      assets
        .filter((a) => a.investable === "investable_cash" || a.investable === "investable_convert")
        .reduce((s, a) => s + (assetBalances.get(a.id) ?? 0), 0),
    [assets, assetBalances],
  )

  function fmt(v: number) {
    return formatAmountWithCurrency(v, currencyCode)
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  const headerCard = (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <CardTitle>{familyOfficeName ?? "—"}</CardTitle>
        <CardDescription>Consolidated wealth overview for this family office.</CardDescription>
      </div>
      {country && (
        <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] leading-none">
          <span className="text-muted-foreground">Country</span>
          <span className="font-medium">{country}</span>
        </span>
      )}
    </div>
  )

  if (noPortfolios) {
    return (
      <div className="p-6 md:p-8 space-y-4">
        <Card>
          <CardHeader>{headerCard}</CardHeader>
          <CardContent>
            <Empty className="border py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Landmark className="size-4" /></EmptyMedia>
                <EmptyTitle>No member portfolios</EmptyTitle>
                <EmptyDescription>Link portfolios from the Members page to see aggregated data here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats = [
    { label: "Net Worth", value: fmt(netAssets - debts), highlight: true },
    { label: "Investments", value: fmt(netAssets - cashOnHand), highlight: false },
    { label: "Cash on hand", value: fmt(cashOnHand), highlight: false },
    { label: "Debts", value: fmt(debts), highlight: debts > 0 },
    { label: "Investable", value: fmt(investable), highlight: false },
    { label: "Tax Estimate", value: "—", highlight: false },
  ]

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>{headerCard}</CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs">{s.label}</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.highlight ? "text-foreground" : ""}`}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <PortfolioTrendChart data={trendData} assetsHref={`/family-office/${familyOfficeId}/assets`} />
      </div>
    </div>
  )
}
