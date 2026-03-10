"use client"

import * as React from "react"
import { fetchEntityAssets, type EntityAsset } from "@/lib/entity-assets"
import { fetchEntityLiabilities, type Liability } from "@/lib/liabilities"
import { computeAll, type PaymentScheme } from "@/lib/amortization"
import { formatAmountWithCurrency } from "@/lib/entity-transactions"
import { fetchMarketQuote } from "@/lib/market"
import { PortfolioTrendChart } from "@/components/portfolio-trend-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function getOutstanding(l: Liability, paidCount: number): number {
  const p = l.loan_amount ?? 0
  if (paidCount === 0 || !l.interest_rate || !l.term_length || !l.frequency || !l.scheme) return p
  const periods = computeAll(p, l.interest_rate, l.frequency, l.term_length)[l.scheme as PaymentScheme]
  return periods[Math.min(paidCount, l.term_length) - 1]?.closing ?? p
}

export function PortfolioOverview({
  entityUUID,
  portfolioId,
  portfolioName,
}: {
  entityUUID: string
  portfolioId: string
  portfolioName: string | null
}) {
  const [assets, setAssets] = React.useState<EntityAsset[]>([])
  const [liabilities, setLiabilities] = React.useState<Liability[]>([])
  const [assetBalances, setAssetBalances] = React.useState<Map<string, number>>(new Map())
  const [paidMap, setPaidMap] = React.useState<Map<string, number>>(new Map())
  const [trendData, setTrendData] = React.useState<{ label: string; value: number }[]>([])
  const [loading, setLoading] = React.useState(true)
  const [currencyCode, setCurrencyCode] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [assetList, liabilityList, entriesPayload] = await Promise.all([
          fetchEntityAssets(entityUUID),
          fetchEntityLiabilities(entityUUID).catch(() => []),
          fetch(`/api/transaction-entries?entity=${entityUUID}`).then((r) =>
            r.ok ? r.json() : { entries: [] }
          ),
        ])

        setAssets(assetList)
        setLiabilities(liabilityList)
        setCurrencyCode(assetList.find((a) => a.currencyCode)?.currencyCode ?? null)

        const rawEntries = Array.isArray(
          (entriesPayload as { entries?: unknown[] }).entries,
        )
          ? (entriesPayload as { entries: Record<string, unknown>[] }).entries
          : []

        const balances = new Map<string, number>()
        const unitBalances = new Map<string, number>()
        const pm = new Map<string, number>()
        const txPoints: { date: number; assetId: string; delta: number }[] = []

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

        setPaidMap(pm)

        // Identify ticker assets
        const tickerByAsset = new Map<string, string>()
        for (const asset of assetList) {
          const ticker = asset.instrument?.ticker?.trim().toUpperCase()
          if (ticker) tickerByAsset.set(asset.id, ticker)
        }

        const uniqueTickers = Array.from(new Set(tickerByAsset.values()))

        // Fetch mutations and live quotes in parallel
        const [mutationsData, quotesMap] = await Promise.all([
          fetch(`/api/mutations?entity=${entityUUID}`)
            .then((r) => (r.ok ? (r.json() as Promise<Array<Record<string, unknown>>>) : Promise.resolve([])))
            .catch(() => [] as Array<Record<string, unknown>>),
          (async () => {
            const qm = new Map<string, number>()
            await Promise.all(
              uniqueTickers.map(async (ticker) => {
                try {
                  const q = await fetchMarketQuote(ticker)
                  if (typeof q.price === "number" && q.price > 0) qm.set(ticker, q.price)
                } catch {
                  // ignore
                }
              }),
            )
            return qm
          })(),
        ])

        // Apply mutations to monetary balances
        for (const m of mutationsData) {
          const assetId = typeof m.asset === "string" ? m.asset : null
          const delta = typeof m.delta === "number" ? m.delta : 0
          if (assetId) balances.set(assetId, (balances.get(assetId) ?? 0) + delta)
        }

        // Apply live prices for ticker assets (units × price)
        for (const [assetId, ticker] of tickerByAsset) {
          if (quotesMap.has(ticker)) {
            const units = unitBalances.get(assetId) ?? 0
            balances.set(assetId, units > 0 ? units * quotesMap.get(ticker)! : 0)
          }
        }

        setAssetBalances(balances)

        // Build trend chart (uses transaction entry prices, not live)
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
  }, [entityUUID])

  const netAssets = React.useMemo(
    () => Array.from(assetBalances.values()).reduce((s, v) => s + v, 0),
    [assetBalances],
  )
  const debts = React.useMemo(
    () => liabilities.reduce((s, l) => s + getOutstanding(l, paidMap.get(l.id) ?? 0), 0),
    [liabilities, paidMap],
  )
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

  const stats = loading
    ? Array.from({ length: 6 }, (_, i) => ({
        label: ["Net Worth", "Investments", "Cash on hand", "Debts", "Investable", "Tax Estimate"][i],
        value: "—",
        highlight: false,
      }))
    : [
        { label: "Net Worth", value: fmt(netAssets - debts), highlight: true },
        { label: "Investments", value: fmt(netAssets - cashOnHand), highlight: false },
        { label: "Cash on hand", value: fmt(cashOnHand), highlight: false },
        { label: "Debts", value: fmt(debts), highlight: debts > 0 },
        { label: "Investable", value: fmt(investable), highlight: false },
        { label: "Tax Estimate", value: "—", highlight: false },
      ]

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{portfolioName ?? "—"}</CardTitle>
            <CardDescription>Financial overview for this portfolio.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs">{s.label}</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.highlight && !loading ? "text-foreground" : ""}`}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <PortfolioTrendChart data={trendData} assetsHref={`/portfolio/${portfolioId}/assets`} />
      </div>
    </div>
  )
}
