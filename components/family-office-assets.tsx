"use client"

import * as React from "react"
import Link from "next/link"
import { Landmark } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { fetchEntityAssets, formatCurrency, type EntityAsset } from "@/lib/entity-assets"
import { fetchEntityTransactions, isCapitalTransaction, type EntityTransaction } from "@/lib/entity-transactions"
import { fetchEntityMutations, type Mutation } from "@/lib/mutations"
import { fetchFxRates } from "@/lib/fx"
import { fetchMarketQuote } from "@/lib/market"
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

type PortfolioSlice = {
  linkId: string
  portfolioId: string       // sub-table UUID (matches UnifiedEntity.id)
  portfolioEntityId: string // entity table UUID (for fetching assets)
  portfolioName: string
  assets: EntityAsset[]
  transactions: EntityTransaction[]
  mutations: Mutation[]
  balances: Map<string, number>
}

const ALL_TAB = "__all__"

// ---------------------------------------------------------------------------
// Balance helpers
// ---------------------------------------------------------------------------

function computeBalances(
  assets: EntityAsset[],
  transactions: EntityTransaction[],
  mutations: Mutation[],
): Map<string, number> {
  const balances = new Map<string, number>()
  for (const tx of transactions) {
    for (const leg of tx.legs) {
      const cur = balances.get(leg.assetId) ?? 0
      balances.set(leg.assetId, leg.direction === "in" ? cur + leg.amount : cur - leg.amount)
    }
  }
  for (const m of mutations) {
    balances.set(m.assetId, (balances.get(m.assetId) ?? 0) + m.delta)
  }
  // Seed assets with `amount` if no transaction history
  for (const asset of assets) {
    if (!balances.has(asset.id)) {
      const raw = asset as unknown as { amount?: number }
      if (typeof raw.amount === "number") balances.set(asset.id, raw.amount)
    }
  }
  return balances
}

function normCurrency(code: string | null | undefined): string {
  return (code ?? "EUR").toUpperCase()
}

// ---------------------------------------------------------------------------
// Asset row (read-only)
// ---------------------------------------------------------------------------

function AssetRow({
  asset,
  balance,
  transactions,
  liveQuotes,
  fxRates,
  baseCurrency,
  portfolioName,
  showPortfolio,
  portfolioId,
}: {
  asset: EntityAsset
  balance: number
  transactions: EntityTransaction[]
  liveQuotes: Record<string, { price: number; asOf: number | null }>
  fxRates: Record<string, number>
  baseCurrency: string
  portfolioName: string
  showPortfolio: boolean
  portfolioId: string
}) {
  const ticker = asset.instrument?.ticker?.trim().toUpperCase() ?? ""
  const quoteInfo = ticker ? (liveQuotes[ticker] ?? null) : null
  const assetCurrency = normCurrency(asset.currencyCode)
  const base = normCurrency(baseCurrency)

  function toBase(native: number, currency: string): number {
    const c = normCurrency(currency)
    if (c === base) return native
    const rate = fxRates[c]
    return rate && rate > 0 ? native * rate : native
  }

  // Compute net units for ticker assets
  let netUnits: number | null = ticker ? 0 : null
  let txIn = 0
  let txOut = 0
  for (const tx of transactions) {
    if (!isCapitalTransaction(tx)) continue
    for (const leg of tx.legs) {
      if (leg.assetId !== asset.id) continue
      if (leg.direction === "in") txIn += leg.amount
      else txOut += leg.amount
      if (netUnits !== null && leg.units != null) {
        netUnits += leg.direction === "in" ? leg.units : -leg.units
      }
    }
  }

  const isSold = txOut > 0 && (netUnits !== null ? netUnits <= 0 : false)

  // Compute display value
  let nativeValue: number
  if (quoteInfo && netUnits != null && netUnits > 0) {
    nativeValue = quoteInfo.price * netUnits
  } else if (quoteInfo && netUnits === null) {
    nativeValue = quoteInfo.price
  } else {
    nativeValue = balance
  }
  const baseValue = toBase(nativeValue, assetCurrency)

  // G/L
  const netCost = txIn - txOut || txIn
  const gl = quoteInfo
    ? (netUnits != null ? quoteInfo.price * netUnits : quoteInfo.price) - netCost
    : balance - netCost
  const glBase = toBase(gl, assetCurrency)
  const glPct = netCost !== 0 ? (gl / netCost) * 100 : 0
  const glUp = gl >= 0

  const showGl = netCost > 0 && !isSold
  const showValue = nativeValue !== 0 || txIn > 0

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30">
      <td className="px-3 py-3">
        <div>
          <p className="font-medium text-sm">{asset.name || "—"}</p>
          {asset.className && (
            <p className="text-xs text-muted-foreground">{asset.className}</p>
          )}
          {ticker && (
            <p className="text-xs text-muted-foreground font-mono">{ticker}</p>
          )}
          {isSold && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
              Sold
            </span>
          )}
        </div>
      </td>
      {showPortfolio && (
        <td className="px-3 py-3">
          <Link
            href={`/portfolio/${portfolioId}`}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {portfolioName}
          </Link>
        </td>
      )}
      <td className="px-3 py-3 tabular-nums text-sm">
        {showValue ? (
          <div className="flex flex-col gap-0.5">
            <span>{formatCurrency(baseValue, baseCurrency)}</span>
            {assetCurrency !== base && (
              <span className="text-xs text-muted-foreground">
                {formatCurrency(nativeValue, assetCurrency)}
                {quoteInfo ? " · live" : ""}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 tabular-nums text-sm">
        {showGl && netCost > 0 ? (
          <div className="flex flex-col gap-0.5">
            <span className={glUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}>
              {glUp ? "+" : "−"}{formatCurrency(Math.abs(glBase), baseCurrency)}
            </span>
            <span className={`text-xs ${glUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
              {glPct >= 0 ? "+" : ""}{glPct.toFixed(2)}%
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}

function AssetTable({
  assets,
  balances,
  transactions,
  liveQuotes,
  fxRates,
  baseCurrency,
  showPortfolio,
  getPortfolioName,
  getPortfolioId,
}: {
  assets: EntityAsset[]
  balances: Map<string, number>
  transactions: EntityTransaction[]
  liveQuotes: Record<string, { price: number; asOf: number | null }>
  fxRates: Record<string, number>
  baseCurrency: string
  showPortfolio: boolean
  getPortfolioName: (assetEntityId: string) => string
  getPortfolioId: (assetEntityId: string) => string
}) {
  const active = assets.filter((a) => !a.archived)
  if (active.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No assets in this portfolio.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">Asset</th>
            {showPortfolio && (
              <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">Portfolio</th>
            )}
            <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">Value</th>
            <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">G/L</th>
          </tr>
        </thead>
        <tbody>
          {active.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              balance={balances.get(asset.id) ?? 0}
              transactions={transactions.filter((t) =>
                t.legs.some((l) => l.assetId === asset.id)
              )}
              liveQuotes={liveQuotes}
              fxRates={fxRates}
              baseCurrency={baseCurrency}
              portfolioName={getPortfolioName(asset.entityId)}
              portfolioId={getPortfolioId(asset.entityId)}
              showPortfolio={showPortfolio}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FamilyOfficeAssets({
  familyOfficeId,
  allPortfolios,
  baseCurrency = "EUR",
}: {
  familyOfficeId: string
  allPortfolios: UnifiedEntity[]
  baseCurrency?: string
}) {
  const [slices, setSlices] = React.useState<PortfolioSlice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState(ALL_TAB)
  const [liveQuotes, setLiveQuotes] = React.useState<Record<string, { price: number; asOf: number | null }>>({})
  const [fxRates, setFxRates] = React.useState<Record<string, number>>({})

  // Map entityId → portfolio info for lookup from asset rows
  const entityToPortfolio = React.useMemo(() => {
    const m = new Map<string, { name: string; portfolioId: string }>()
    for (const slice of slices) {
      m.set(slice.portfolioEntityId, { name: slice.portfolioName, portfolioId: slice.portfolioId })
    }
    return m
  }, [slices])

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // 1. Fetch portfolio links for this family office
        const linksRes = await fetch(`/api/family-office-portfolios?family_office=${familyOfficeId}`)
        const links: FoPortfolioLink[] = linksRes.ok ? await linksRes.json() : []

        if (links.length === 0) {
          setSlices([])
          setLoading(false)
          return
        }

        // 2. Cross-reference with allPortfolios to get entity UUIDs
        const portfolioById = new Map(allPortfolios.map((p) => [p.id, p]))

        // 3. Fetch assets + transactions + mutations for each portfolio in parallel
        const loadedSlices = await Promise.all(
          links.map(async (link) => {
            const portfolio = portfolioById.get(link.portfolio)
            const entityId = portfolio?.entity ?? ""
            const name = link.label ?? portfolio?.name ?? "Unnamed"

            if (!entityId) {
              return {
                linkId: link.id,
                portfolioId: link.portfolio,
                portfolioEntityId: entityId,
                portfolioName: name,
                assets: [],
                transactions: [],
                mutations: [],
                balances: new Map<string, number>(),
              }
            }

            const [assets, transactions, mutations] = await Promise.all([
              fetchEntityAssets(entityId).catch(() => [] as EntityAsset[]),
              fetchEntityTransactions(entityId).catch(() => [] as EntityTransaction[]),
              fetchEntityMutations(entityId).catch(() => [] as Mutation[]),
            ])

            const balances = computeBalances(assets, transactions, mutations)

            return {
              linkId: link.id,
              portfolioId: link.portfolio,
              portfolioEntityId: entityId,
              portfolioName: name,
              assets,
              transactions,
              mutations,
              balances,
            } satisfies PortfolioSlice
          })
        )

        setSlices(loadedSlices)

        // 4. Fetch FX rates
        const allCurrencies = Array.from(
          new Set(loadedSlices.flatMap((s) => s.assets.map((a) => normCurrency(a.currencyCode))))
        )
        fetchFxRates(normCurrency(baseCurrency), allCurrencies)
          .then(setFxRates)
          .catch(() => {})

        // 5. Fetch live quotes for all tickers
        const allTickers = Array.from(
          new Set(
            loadedSlices
              .flatMap((s) => s.assets)
              .map((a) => a.instrument?.ticker?.trim().toUpperCase() ?? "")
              .filter(Boolean)
          )
        )
        if (allTickers.length > 0) {
          Promise.all(
            allTickers.map(async (ticker) => {
              try {
                const q = await fetchMarketQuote(ticker)
                if (typeof q.price === "number" && q.price > 0) {
                  setLiveQuotes((prev) => ({
                    ...prev,
                    [ticker]: { price: q.price as number, asOf: typeof q.asOf === "number" ? q.asOf : null },
                  }))
                }
              } catch { /* ignore */ }
            })
          ).catch(() => {})
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [familyOfficeId, allPortfolios, baseCurrency])

  // Reset active tab if it no longer exists
  React.useEffect(() => {
    if (activeTab !== ALL_TAB && !slices.some((s) => s.linkId === activeTab)) {
      setActiveTab(ALL_TAB)
    }
  }, [slices, activeTab])

  // Aggregate all-tab data
  const allAssets = React.useMemo(() => slices.flatMap((s) => s.assets), [slices])
  const allBalances = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const s of slices) s.balances.forEach((v, k) => m.set(k, v))
    return m
  }, [slices])
  const allTransactions = React.useMemo(() => slices.flatMap((s) => s.transactions), [slices])

  const activeSlice = activeTab === ALL_TAB ? null : slices.find((s) => s.linkId === activeTab)

  // Compute total value for a set of assets
  function computeTotal(assets: EntityAsset[], balances: Map<string, number>, transactions: EntityTransaction[]) {
    let total = 0
    for (const asset of assets) {
      if (asset.archived) continue
      const ticker = asset.instrument?.ticker?.trim().toUpperCase() ?? ""
      const quote = ticker ? liveQuotes[ticker] : null
      let units: number | null = ticker ? 0 : null
      for (const tx of transactions) {
        for (const leg of tx.legs) {
          if (leg.assetId !== asset.id || leg.units == null) continue
          units = (units ?? 0) + (leg.direction === "in" ? leg.units : -leg.units)
        }
      }
      const nativeVal = quote
        ? (units != null ? quote.price * units : quote.price)
        : (balances.get(asset.id) ?? 0)
      // FX convert to base
      const assetCurr = normCurrency(asset.currencyCode)
      const base = normCurrency(baseCurrency)
      const rate = fxRates[assetCurr]
      const baseVal = assetCurr === base ? nativeVal : (rate && rate > 0 ? nativeVal * rate : nativeVal)
      total += baseVal
    }
    return total
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (slices.length === 0) {
    return (
      <div className="p-6 md:p-8">
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Landmark className="size-4" />
            </EmptyMedia>
            <EmptyTitle>No member portfolios</EmptyTitle>
            <EmptyDescription>
              Link portfolios from the Members page to see aggregated assets here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const displayAssets = activeSlice ? activeSlice.assets : allAssets
  const displayBalances = activeSlice ? activeSlice.balances : allBalances
  const displayTransactions = activeSlice ? activeSlice.transactions : allTransactions
  const totalValue = computeTotal(displayAssets, displayBalances, displayTransactions)

  return (
    <div className="p-6 md:p-8 space-y-4">
      {/* Total value card */}
      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
          <p className="text-muted-foreground text-sm mt-1">
            Aggregated across all member portfolios. Read-only view.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Assets</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {formatCurrency(totalValue, baseCurrency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {displayAssets.filter((a) => !a.archived).length} assets
              {activeSlice ? ` · ${activeSlice.portfolioName}` : ` · ${slices.length} portfolios`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sheet tiles + asset table */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Sheets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Virtual sheet tiles */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveTab(ALL_TAB)}
              className={`min-w-48 rounded-md border p-3 text-left transition-colors ${
                activeTab === ALL_TAB ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              }`}
            >
              <p className="font-semibold text-sm">All Assets</p>
              <p className="mt-1 text-xl tabular-nums">
                {formatCurrency(computeTotal(allAssets, allBalances, allTransactions), baseCurrency)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {slices.length} {slices.length === 1 ? "portfolio" : "portfolios"}
              </p>
            </button>

            {slices.map((slice) => {
              const val = computeTotal(slice.assets, slice.balances, slice.transactions)
              const isActive = activeTab === slice.linkId
              return (
                <button
                  key={slice.linkId}
                  type="button"
                  onClick={() => setActiveTab(slice.linkId)}
                  className={`min-w-48 rounded-md border p-3 text-left transition-colors ${
                    isActive ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  <p className="font-semibold text-sm">{slice.portfolioName}</p>
                  <p className="mt-1 text-xl tabular-nums">
                    {formatCurrency(val, baseCurrency)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {slice.assets.filter((a) => !a.archived).length} assets
                  </p>
                </button>
              )
            })}
          </div>

          {/* Asset table */}
          <AssetTable
            assets={displayAssets}
            balances={displayBalances}
            transactions={displayTransactions}
            liveQuotes={liveQuotes}
            fxRates={fxRates}
            baseCurrency={baseCurrency}
            showPortfolio={activeTab === ALL_TAB}
            getPortfolioName={(entityId) => entityToPortfolio.get(entityId)?.name ?? ""}
            getPortfolioId={(entityId) => entityToPortfolio.get(entityId)?.portfolioId ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  )
}
