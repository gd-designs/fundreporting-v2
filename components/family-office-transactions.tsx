"use client"

import * as React from "react"
import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  fetchEntityTransactions,
  formatAmountWithCurrency,
  formatTxDate,
  type EntityTransaction,
} from "@/lib/entity-transactions"
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
  transactions: EntityTransaction[]
}

const ALL_TAB = "__all__"

// ---------------------------------------------------------------------------
// Helpers (identical to transactions-manager.tsx)
// ---------------------------------------------------------------------------

function typeColor(typeName: string): string {
  const t = typeName.toLowerCase()
  if (t === "buy" || t === "transfer in") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
  if (t === "sell" || t === "sale" || t === "transfer out") return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
  if (t.includes("income") || t.includes("dividend") || t.includes("distribution")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
  if (t.includes("expense") || t.includes("fee")) return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
  return "bg-muted text-muted-foreground"
}

function entryTypeBadgeColor(entryType: string): string {
  const t = entryType.toLowerCase()
  if (t === "cash") return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
  if (t === "asset") return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
  if (t === "income") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
  if (t === "expense" || t === "fee") return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
  return "bg-muted text-muted-foreground"
}

function computeStats(transactions: EntityTransaction[]) {
  let capitalIn = 0
  let withdrawals = 0
  for (const tx of transactions) {
    const typeLower = tx.typeName.toLowerCase()
    const isNewMoney = typeLower.includes("new money") || typeLower.includes("capital") || typeLower.includes("deposit")
    const isWithdrawal = typeLower.includes("withdrawal") || typeLower.includes("withdraw") || typeLower.includes("distribution")
    for (const leg of tx.legs) {
      if (leg.entryType === "cash") {
        if (isNewMoney && leg.direction === "in") capitalIn += leg.amount
        else if (isWithdrawal && leg.direction === "out") withdrawals += leg.amount
      }
    }
  }
  return { capitalIn, withdrawals }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FamilyOfficeTransactions({
  familyOfficeId,
  allPortfolios,
}: {
  familyOfficeId: string
  allPortfolios: UnifiedEntity[]
}) {
  const [slices, setSlices] = React.useState<PortfolioSlice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState(ALL_TAB)
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
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
              return { linkId: link.id, portfolioId: link.portfolio, portfolioEntityId: entityId, portfolioName: name, transactions: [] }
            }

            const transactions = await fetchEntityTransactions(entityId).catch(() => [] as EntityTransaction[])
            return {
              linkId: link.id,
              portfolioId: link.portfolio,
              portfolioEntityId: entityId,
              portfolioName: name,
              transactions: transactions.sort((a, b) => b.date - a.date),
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
  const displayTransactions = activeSlice
    ? activeSlice.transactions
    : slices.flatMap((s) => s.transactions).sort((a, b) => b.date - a.date)

  // Lookup which portfolio a transaction belongs to (for all-tab Portfolio column)
  const txToPortfolio = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const s of slices) {
      for (const tx of s.transactions) m.set(tx.id, s.portfolioName)
    }
    return m
  }, [slices])

  const stats = React.useMemo(() => computeStats(displayTransactions), [displayTransactions])

  const primaryCurrency = React.useMemo(() => {
    for (const tx of displayTransactions) {
      for (const leg of tx.legs) {
        if (leg.currencyCode) return leg.currencyCode
      }
    }
    return null
  }, [displayTransactions])

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
            Link portfolios from the Members page to see aggregated transactions here.
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
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Transactions</p>
          <p className="text-2xl font-semibold mt-1">{displayTransactions.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Capital In</p>
          <p className={`text-2xl font-semibold mt-1 ${stats.capitalIn > 0 ? "text-emerald-600" : ""}`}>
            +{formatAmountWithCurrency(stats.capitalIn, primaryCurrency)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Withdrawals</p>
          <p className={`text-2xl font-semibold mt-1 ${stats.withdrawals > 0 ? "text-red-600" : ""}`}>
            −{formatAmountWithCurrency(stats.withdrawals, primaryCurrency)}
          </p>
        </div>
      </div>

      {/* Portfolio tiles + transactions list */}
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
            <p className="mt-1 text-lg tabular-nums">
              {slices.reduce((s, sl) => s + sl.transactions.length, 0)} transactions
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {slices.length} {slices.length === 1 ? "portfolio" : "portfolios"}
            </p>
          </button>

          {slices.map((slice) => {
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
                <p className="mt-1 text-lg tabular-nums">{slice.transactions.length} transactions</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {slice.transactions[0] ? formatTxDate(slice.transactions[0].date) : "—"}
                </p>
              </button>
            )
          })}
        </div>

        {displayTransactions.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No transactions yet.</div>
        ) : (
          displayTransactions.map((tx) => {
            const expanded = expandedIds.has(tx.id)
            const portfolioName = txToPortfolio.get(tx.id)

            return (
              <div key={tx.id} className="border-b last:border-b-0">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(tx.id)}
                >
                  <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeColor(tx.typeName)}`}>
                    {tx.typeName || "—"}
                  </span>
                  <span className="text-sm font-medium truncate flex-1">
                    {tx.reference || "—"}
                  </span>
                  {activeTab === ALL_TAB && portfolioName && (
                    <span className="text-xs text-muted-foreground shrink-0">{portfolioName}</span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTxDate(tx.date)}
                  </span>
                </div>

                {expanded && (
                  <div className="px-4 pb-3 space-y-1.5">
                    {tx.legs.map((leg) => (
                      <div key={leg.id} className="flex items-center gap-2 text-xs">
                        {leg.direction === "in" ? (
                          <ArrowDownLeft className="size-3 shrink-0 text-emerald-600" />
                        ) : (
                          <ArrowUpRight className="size-3 shrink-0 text-red-500" />
                        )}
                        <span className="w-36 truncate text-sm">{leg.assetName || leg.objectName || "—"}</span>
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${entryTypeBadgeColor(leg.entryType)}`}>
                          {leg.entryTypeLabel || leg.entryType || "—"}
                        </span>
                        <span className={`tabular-nums font-medium ${leg.direction === "in" ? "text-emerald-600" : "text-red-500"}`}>
                          {leg.direction === "in" ? "+" : "−"}
                          {formatAmountWithCurrency(leg.amount, leg.currencyCode)}
                        </span>
                        <span className="text-muted-foreground truncate">{leg.entityName || "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
