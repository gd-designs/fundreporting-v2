"use client"

import * as React from "react"
import { Landmark } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { fetchEntityLiabilities, type Liability } from "@/lib/liabilities"
import { fetchEntityAssets, type EntityAsset } from "@/lib/entity-assets"
import { formatAmountWithCurrency } from "@/lib/entity-transactions"
import { LiabilitySheet } from "@/components/liability-sheet"
import { computeAll, type PaymentScheme } from "@/lib/amortization"
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

type PaidInfo = { count: number; lastDate: number | null }

type PortfolioSlice = {
  linkId: string
  portfolioId: string
  portfolioEntityId: string
  portfolioName: string
  liabilities: Liability[]
  assetMap: Map<string, EntityAsset>
  paidMap: Map<string, PaidInfo>
}

const ALL_TAB = "__all__"

// ---------------------------------------------------------------------------
// Helpers (identical to liabilities-manager.tsx)
// ---------------------------------------------------------------------------

function getOutstanding(l: Liability, paidCount: number): number {
  const p = l.loan_amount ?? 0
  if (paidCount === 0 || !l.interest_rate || !l.term_length || !l.frequency || !l.scheme) return p
  const periods = computeAll(p, l.interest_rate, l.frequency, l.term_length)[l.scheme as PaymentScheme]
  return periods[Math.min(paidCount, l.term_length) - 1]?.closing ?? p
}

function getNextPayment(l: Liability, paidCount: number): number | null {
  if (!l.loan_amount || !l.interest_rate || !l.term_length || !l.frequency || !l.scheme) return null
  if (paidCount >= l.term_length) return null
  const periods = computeAll(l.loan_amount, l.interest_rate, l.frequency, l.term_length)[l.scheme as PaymentScheme]
  return periods[paidCount]?.payment ?? null
}

function schemeBadgeColor(scheme: string | null | undefined): string {
  if (scheme === "linear") return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
  if (scheme === "annuity") return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
  if (scheme === "bullet") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
  return "bg-muted text-muted-foreground"
}

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(ms))
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FamilyOfficeLiabilities({
  familyOfficeId,
  allPortfolios,
}: {
  familyOfficeId: string
  allPortfolios: UnifiedEntity[]
}) {
  const [slices, setSlices] = React.useState<PortfolioSlice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState(ALL_TAB)
  const [sheetLiability, setSheetLiability] = React.useState<Liability | null>(null)
  const [sheetAssetName, setSheetAssetName] = React.useState<string | null | undefined>(null)
  const [sheetDefaultTab, setSheetDefaultTab] = React.useState("overview")

  function openSheet(l: Liability, assetMap: Map<string, EntityAsset>, tab = "overview") {
    setSheetDefaultTab(tab)
    setSheetAssetName(l.asset ? assetMap.get(l.asset)?.name : null)
    setSheetLiability(l)
  }

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
              return {
                linkId: link.id,
                portfolioId: link.portfolio,
                portfolioEntityId: entityId,
                portfolioName: name,
                liabilities: [],
                assetMap: new Map<string, EntityAsset>(),
                paidMap: new Map<string, PaidInfo>(),
              }
            }

            const [libs, assets, entriesPayload] = await Promise.all([
              fetchEntityLiabilities(entityId).catch(() => [] as Liability[]),
              fetchEntityAssets(entityId).catch(() => [] as EntityAsset[]),
              fetch(`/api/transaction-entries?entity=${entityId}`)
                .then((r) => r.ok ? r.json() : { entries: [] })
                .catch(() => ({ entries: [] })),
            ])

            const assetMap = new Map(assets.map((a) => [a.id, a]))

            const rawEntries = Array.isArray((entriesPayload as { entries?: unknown[] }).entries)
              ? (entriesPayload as { entries: Record<string, unknown>[] }).entries
              : []
            const pm = new Map<string, PaidInfo>()
            for (const e of rawEntries) {
              if (e.entry_type !== "principal" || e.direction !== "out" || e.object_type !== "liability") continue
              const objId = typeof e.object_id === "string" ? e.object_id : null
              if (!objId) continue
              const tx = e._transaction as Record<string, unknown> | undefined
              const txDate = tx && typeof tx.date === "number" ? tx.date : null
              const existing = pm.get(objId) ?? { count: 0, lastDate: null }
              pm.set(objId, {
                count: existing.count + 1,
                lastDate: txDate != null ? Math.max(existing.lastDate ?? 0, txDate) : existing.lastDate,
              })
            }

            return {
              linkId: link.id,
              portfolioId: link.portfolio,
              portfolioEntityId: entityId,
              portfolioName: name,
              liabilities: libs.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)),
              assetMap,
              paidMap: pm,
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

  // Reset tab if it no longer exists
  React.useEffect(() => {
    if (activeTab !== ALL_TAB && !slices.some((s) => s.linkId === activeTab)) {
      setActiveTab(ALL_TAB)
    }
  }, [slices, activeTab])

  const activeSlice = activeTab === ALL_TAB ? null : slices.find((s) => s.linkId === activeTab)

  const displayLiabilities = activeSlice
    ? activeSlice.liabilities
    : slices.flatMap((s) => s.liabilities)

  const mergedAssetMap = React.useMemo(() => {
    if (activeSlice) return activeSlice.assetMap
    const m = new Map<string, EntityAsset>()
    for (const s of slices) s.assetMap.forEach((v, k) => m.set(k, v))
    return m
  }, [slices, activeSlice])

  const mergedPaidMap = React.useMemo(() => {
    if (activeSlice) return activeSlice.paidMap
    const m = new Map<string, PaidInfo>()
    for (const s of slices) s.paidMap.forEach((v, k) => m.set(k, v))
    return m
  }, [slices, activeSlice])

  // Stats
  const totalOutstanding = displayLiabilities.reduce((sum, l) => {
    const paid = mergedPaidMap.get(l.id)
    return sum + getOutstanding(l, paid?.count ?? 0)
  }, 0)

  const avgRate = displayLiabilities.length > 0
    ? displayLiabilities.reduce((s, l) => s + (l.interest_rate ?? 0), 0) /
      displayLiabilities.filter((l) => l.interest_rate != null).length
    : 0

  const primaryCurrency = React.useMemo(() => {
    for (const l of displayLiabilities) {
      if (l.asset) {
        const asset = mergedAssetMap.get(l.asset)
        if (asset?.currencyCode) return asset.currencyCode
      }
    }
    return null
  }, [displayLiabilities, mergedAssetMap])

  function sliceOutstanding(slice: PortfolioSlice): number {
    return slice.liabilities.reduce((sum, l) => {
      const paid = slice.paidMap.get(l.id)
      return sum + getOutstanding(l, paid?.count ?? 0)
    }, 0)
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
            Link portfolios from the Members page to see aggregated liabilities here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <LiabilitySheet
        liability={sheetLiability}
        open={!!sheetLiability}
        onOpenChange={(v) => { if (!v) setSheetLiability(null) }}
        assetName={sheetAssetName}
        defaultTab={sheetDefaultTab}
      />

      <div className="space-y-6">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total liabilities</p>
            <p className="text-2xl font-semibold mt-1">{displayLiabilities.length}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total outstanding</p>
            <p className="text-2xl font-semibold mt-1 text-red-500">
              {formatAmountWithCurrency(totalOutstanding, primaryCurrency)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Avg interest rate</p>
            <p className="text-2xl font-semibold mt-1">
              {displayLiabilities.some((l) => l.interest_rate != null) ? `${avgRate.toFixed(2)}%` : "—"}
            </p>
          </div>
        </div>

        {/* Portfolio tiles + liabilities table */}
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
              <p className="mt-1 text-lg tabular-nums text-red-500">
                {formatAmountWithCurrency(totalOutstanding, primaryCurrency)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {slices.length} {slices.length === 1 ? "portfolio" : "portfolios"}
              </p>
            </button>

            {slices.map((slice) => {
              const outstanding = sliceOutstanding(slice)
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
                  <p className="mt-1 text-lg tabular-nums text-red-500">
                    {formatAmountWithCurrency(outstanding, null)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {slice.liabilities.length} liabilities
                  </p>
                </button>
              )
            })}
          </div>

          {displayLiabilities.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No liabilities recorded yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Name</th>
                  <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Asset</th>
                  {activeTab === ALL_TAB && (
                    <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Portfolio</th>
                  )}
                  <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Scheme</th>
                  <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Outstanding</th>
                  <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Last payment</th>
                  <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Next payment</th>
                  <th className="px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayLiabilities.map((l) => {
                  const asset = l.asset ? mergedAssetMap.get(l.asset) : undefined
                  const paid = mergedPaidMap.get(l.id)
                  const paidCount = paid?.count ?? 0
                  const outstanding = getOutstanding(l, paidCount)
                  const nextPayment = getNextPayment(l, paidCount)
                  const ownerSlice = slices.find((s) => s.liabilities.some((sl) => sl.id === l.id))

                  return (
                    <tr key={l.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{l.name || "—"}</div>
                        {l.reference && (
                          <div className="text-xs text-muted-foreground">{l.reference}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {asset ? (
                          <>
                            <div className="font-medium">{asset.name || "—"}</div>
                            {asset.className && (
                              <div className="text-xs text-muted-foreground">{asset.className}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {activeTab === ALL_TAB && (
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {ownerSlice?.portfolioName ?? "—"}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {l.scheme ? (
                          <button
                            type="button"
                            onClick={() => openSheet(l, mergedAssetMap, "scheme")}
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide cursor-pointer hover:opacity-80 transition-opacity ${schemeBadgeColor(l.scheme)}`}
                          >
                            {l.scheme}
                          </button>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-red-500">
                        {l.loan_amount != null
                          ? formatAmountWithCurrency(outstanding, asset?.currencyCode ?? null)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {paid?.lastDate ? formatDate(paid.lastDate) : "—"}
                        {paidCount > 0 && (
                          <div className="text-xs text-muted-foreground">{paidCount} paid</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {nextPayment != null
                          ? formatAmountWithCurrency(nextPayment, asset?.currencyCode ?? null)
                          : paidCount > 0 && l.term_length != null && paidCount >= l.term_length
                            ? <span className="text-xs text-green-600 font-medium">Paid off</span>
                            : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => openSheet(l, mergedAssetMap)}
                        >
                          Manage
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-semibold">
                  <td
                    colSpan={activeTab === ALL_TAB ? 4 : 3}
                    className="px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground"
                  >
                    Total outstanding
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-500">
                    {formatAmountWithCurrency(totalOutstanding, primaryCurrency)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
