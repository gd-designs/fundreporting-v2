"use client"

import * as React from "react"
import { Landmark, TrendingDown, TrendingUp } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { fetchEntityMutations, type Mutation } from "@/lib/mutations"
import { fetchEntityAssets, type EntityAsset } from "@/lib/entity-assets"
import { formatAmountWithCurrency } from "@/lib/entity-transactions"
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
  portfolioId: string
  portfolioEntityId: string
  portfolioName: string
  mutations: Mutation[]
  assetMap: Map<string, EntityAsset>
}

const ALL_TAB = "__all__"

// ---------------------------------------------------------------------------
// Helpers (identical to mutations-manager.tsx)
// ---------------------------------------------------------------------------

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(ms))
}

function sourceLabel(source: Mutation["source"]): string {
  if (source === "return_profile") return "Return profile"
  if (source === "transaction") return "Transaction"
  return "Manual"
}

function sourceBadgeColor(source: Mutation["source"]): string {
  if (source === "return_profile") return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
  if (source === "transaction") return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
  return "bg-muted text-muted-foreground"
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FamilyOfficeMutations({
  familyOfficeId,
  allPortfolios,
}: {
  familyOfficeId: string
  allPortfolios: UnifiedEntity[]
}) {
  const [slices, setSlices] = React.useState<PortfolioSlice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState(ALL_TAB)

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const linksRes = await fetch(`/api/family-office-portfolios?family_office=${familyOfficeId}`)
        const links: FoPortfolioLink[] = linksRes.ok ? await linksRes.json() : []

        if (links.length === 0) {
          setSlices([])
          setLoading(false)
          return
        }

        const portfolioById = new Map(allPortfolios.map((p) => [p.id, p]))

        const loadedSlices = await Promise.all(
          links.map(async (link) => {
            const portfolio = portfolioById.get(link.portfolio)
            const entityId = portfolio?.entity ?? ""
            const name = link.label ?? portfolio?.name ?? "Unnamed"

            if (!entityId) {
              return { linkId: link.id, portfolioId: link.portfolio, portfolioEntityId: entityId, portfolioName: name, mutations: [], assetMap: new Map<string, EntityAsset>() }
            }

            const [muts, assets] = await Promise.all([
              fetchEntityMutations(entityId).catch(() => [] as Mutation[]),
              fetchEntityAssets(entityId).catch(() => [] as EntityAsset[]),
            ])

            return {
              linkId: link.id,
              portfolioId: link.portfolio,
              portfolioEntityId: entityId,
              portfolioName: name,
              mutations: muts.sort((a, b) => b.date - a.date),
              assetMap: new Map(assets.map((a) => [a.id, a])),
            } satisfies PortfolioSlice
          })
        )

        setSlices(loadedSlices)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [familyOfficeId, allPortfolios])

  React.useEffect(() => {
    if (activeTab !== ALL_TAB && !slices.some((s) => s.linkId === activeTab)) {
      setActiveTab(ALL_TAB)
    }
  }, [slices, activeTab])

  const activeSlice = activeTab === ALL_TAB ? null : slices.find((s) => s.linkId === activeTab)

  const displayMutations = activeSlice
    ? activeSlice.mutations
    : slices.flatMap((s) => s.mutations).sort((a, b) => b.date - a.date)

  const mergedAssetMap = React.useMemo(() => {
    if (activeSlice) return activeSlice.assetMap
    const m = new Map<string, EntityAsset>()
    for (const s of slices) s.assetMap.forEach((v, k) => m.set(k, v))
    return m
  }, [slices, activeSlice])

  // Lookup which portfolio a mutation belongs to
  const mutToPortfolio = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const s of slices) {
      for (const mut of s.mutations) m.set(mut.id, s.portfolioName)
    }
    return m
  }, [slices])

  // Stats
  const totalGrowth = displayMutations.reduce((s, m) => s + (m.delta > 0 ? m.delta : 0), 0)
  const totalDecline = displayMutations.reduce((s, m) => s + (m.delta < 0 ? Math.abs(m.delta) : 0), 0)
  const netChange = displayMutations.reduce((s, m) => s + m.delta, 0)

  const primaryCurrency = React.useMemo(() => {
    for (const m of displayMutations) {
      const asset = mergedAssetMap.get(m.assetId)
      if (asset?.currencyCode) return asset.currencyCode
    }
    return null
  }, [displayMutations, mergedAssetMap])

  function sliceNetChange(slice: PortfolioSlice): number {
    return slice.mutations.reduce((s, m) => s + m.delta, 0)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (slices.length === 0) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Landmark className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No member portfolios</EmptyTitle>
          <EmptyDescription>
            Link portfolios from the Members page to see aggregated mutations here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total mutations</p>
          <p className="text-2xl font-semibold mt-1">{displayMutations.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Net value change</p>
          <p className={`text-2xl font-semibold mt-1 ${netChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {netChange >= 0 ? "+" : "−"}{formatAmountWithCurrency(Math.abs(netChange), primaryCurrency)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Growth</p>
              <p className="text-lg font-semibold mt-1 text-emerald-600">
                +{formatAmountWithCurrency(totalGrowth, primaryCurrency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Decline</p>
              <p className="text-lg font-semibold mt-1 text-red-500">
                −{formatAmountWithCurrency(totalDecline, primaryCurrency)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio tiles + mutations table */}
      <div className="rounded-lg border">
        {/* Portfolio tabs */}
        <div className="flex flex-wrap gap-3 px-4 py-3 border-b">
          <button
            type="button"
            onClick={() => setActiveTab(ALL_TAB)}
            className={`min-w-40 rounded-md border p-3 text-left transition-colors ${
              activeTab === ALL_TAB ? "border-primary bg-primary/5" : "hover:bg-muted/40"
            }`}
          >
            <p className="font-semibold text-sm">All Portfolios</p>
            <p className={`mt-1 text-lg tabular-nums ${netChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {netChange >= 0 ? "+" : "−"}{formatAmountWithCurrency(Math.abs(netChange), primaryCurrency)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {slices.length} {slices.length === 1 ? "portfolio" : "portfolios"}
            </p>
          </button>

          {slices.map((slice) => {
            const net = sliceNetChange(slice)
            const isActive = activeTab === slice.linkId
            return (
              <button
                key={slice.linkId}
                type="button"
                onClick={() => setActiveTab(slice.linkId)}
                className={`min-w-40 rounded-md border p-3 text-left transition-colors ${
                  isActive ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                }`}
              >
                <p className="font-semibold text-sm">{slice.portfolioName}</p>
                <p className={`mt-1 text-lg tabular-nums ${net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {net >= 0 ? "+" : "−"}{formatAmountWithCurrency(Math.abs(net), null)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{slice.mutations.length} mutations</p>
              </button>
            )
          })}
        </div>

        {displayMutations.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No mutations recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Asset</th>
                {activeTab === ALL_TAB && (
                  <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Portfolio</th>
                )}
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Source</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Delta</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayMutations.map((m) => {
                const asset = mergedAssetMap.get(m.assetId)
                const portfolioName = mutToPortfolio.get(m.id)
                return (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(m.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{asset?.name || m.assetId.slice(0, 8) + "…"}</div>
                      {asset?.className && (
                        <div className="text-xs text-muted-foreground">{asset.className}</div>
                      )}
                    </td>
                    {activeTab === ALL_TAB && (
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {portfolioName ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sourceBadgeColor(m.source)}`}>
                        {sourceLabel(m.source)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={`inline-flex items-center gap-1 font-medium ${m.delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {m.delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                        {m.delta >= 0 ? "+" : "−"}
                        {formatAmountWithCurrency(Math.abs(m.delta), asset?.currencyCode ?? null)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                      {m.notes || "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td colSpan={activeTab === ALL_TAB ? 4 : 3} className="px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Net change</td>
                <td className={`px-4 py-2 text-right tabular-nums ${netChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {netChange >= 0 ? "+" : "−"}{formatAmountWithCurrency(Math.abs(netChange), primaryCurrency)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
