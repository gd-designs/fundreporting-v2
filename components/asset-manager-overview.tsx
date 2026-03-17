"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, BarChart3, Landmark, Users2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreateFundDialog, FUND_TYPES, type CreatedFund } from "@/components/create-fund-dialog"

type Fund = CreatedFund & {
  fund_type?: string | null
  aum?: number | null
  inception_date?: number | null
  _currency?: { id: number; code: string; name: string } | null
  _country?: { id: number; name: string; code?: string } | null
}

function formatAum(aum: number, currencyCode?: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode ?? "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(aum)
  } catch {
    return aum.toLocaleString()
  }
}

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ts))
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function AssetManagerOverview({
  assetManagerId,
  assetManagerName,
  initialFunds,
  defaultCurrency,
  defaultCountry,
}: {
  assetManagerId: string
  assetManagerName?: string | null
  initialFunds: Fund[]
  defaultCurrency?: number | null
  defaultCountry?: number | null
}) {
  const [funds, setFunds] = React.useState<Fund[]>(initialFunds)

  const totalAum = funds.reduce((sum, f) => sum + (f.aum ?? 0), 0)
  const fundsByType = FUND_TYPES.map((t) => ({
    ...t,
    count: funds.filter((f) => f.fund_type === t.value).length,
  })).filter((t) => t.count > 0)

  const recentFunds = [...funds].sort((a, b) => (b.inception_date ?? 0) - (a.inception_date ?? 0)).slice(0, 5)

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">{assetManagerName ?? "Asset Manager"}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of funds, investors, and activity.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total funds"
          value={String(funds.length)}
          sub={fundsByType.map((t) => `${t.count} ${t.label}`).join(" · ") || undefined}
        />
        <StatCard
          label="Total AUM"
          value={totalAum > 0 ? formatAum(totalAum, "USD") : "—"}
          sub={totalAum > 0 ? "across all funds" : "No AUM recorded"}
        />
        <StatCard
          label="Avg. AUM / fund"
          value={funds.length > 0 && totalAum > 0 ? formatAum(totalAum / funds.length, "USD") : "—"}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link href={`/asset-manager/${assetManagerId}/funds`} className="rounded-lg border p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors group">
          <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Landmark className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Funds</p>
            <p className="text-xs text-muted-foreground">{funds.length} managed</p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
        <Link href={`/asset-manager/${assetManagerId}/investors`} className="rounded-lg border p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors group">
          <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Users2 className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Investors</p>
            <p className="text-xs text-muted-foreground">Manage leads</p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
        <Link href={`/asset-manager/${assetManagerId}/cap-table`} className="rounded-lg border p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors group">
          <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
            <BarChart3 className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Cap table</p>
            <p className="text-xs text-muted-foreground">Shareholders & commitments</p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>

      {/* Funds list */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Funds</h2>
          <div className="flex items-center gap-2">
            <CreateFundDialog
              assetManagerId={assetManagerId}
              onCreated={(fund) => setFunds((prev) => [fund, ...prev])}
              defaultCurrency={defaultCurrency}
              defaultCountry={defaultCountry}
            />
            {funds.length > 5 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/asset-manager/${assetManagerId}/funds`}>
                  View all
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {funds.length === 0 ? (
          <div className="border rounded-lg py-12 text-center">
            <p className="text-sm text-muted-foreground">No funds yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {recentFunds.map((fund) => (
              <div key={fund.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="font-medium text-sm truncate">{fund.name ?? "Unnamed fund"}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {fund.fund_type && (
                      <Badge variant="secondary" className="text-xs">
                        {FUND_TYPES.find((t) => t.value === fund.fund_type)?.label ?? fund.fund_type}
                      </Badge>
                    )}
                    {fund._currency && (
                      <span className="text-xs text-muted-foreground">{fund._currency.code}</span>
                    )}
                    {fund.inception_date && (
                      <span className="text-xs text-muted-foreground">Est. {formatDate(fund.inception_date)}</span>
                    )}
                    {fund.aum != null && fund.aum > 0 && (
                      <span className="text-xs text-muted-foreground font-medium">
                        AUM {formatAum(fund.aum, fund._currency?.code)}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild className="h-7 px-2 shrink-0">
                  <Link href={`/asset-manager/${assetManagerId}/fund/${fund.id}`}>
                    Open
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
