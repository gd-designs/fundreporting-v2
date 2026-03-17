"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { CreateFundDialog, FUND_TYPES, type CreatedFund } from "@/components/create-fund-dialog"

type Fund = CreatedFund & {
  country?: number | null
  inception_date?: number | null
  aum?: number | null
  fund_type?: string | null
  _country?: { id: number; name: string; code?: string } | null
}

function formatAum(aum: number, currencyCode?: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode ?? "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(aum)
  } catch {
    return aum.toLocaleString()
  }
}

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ts))
}

const FUND_TYPE_FILTERS = [
  { value: "all", label: "All" },
  ...FUND_TYPES,
]

export function FundsManager({
  assetManagerId,
  initialFunds,
  defaultCurrency,
  defaultCountry,
}: {
  assetManagerId: string
  initialFunds: Fund[]
  defaultCurrency?: number | null
  defaultCountry?: number | null
}) {
  const [funds, setFunds] = React.useState<Fund[]>(initialFunds)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState("all")

  async function handleDelete(fund: Fund) {
    if (!window.confirm(`Delete "${fund.name ?? "this fund"}"? This cannot be undone.`)) return
    setDeletingId(fund.id)
    const res = await fetch(`/api/funds/${fund.id}`, { method: "DELETE" })
    setDeletingId(null)
    if (res.ok) setFunds((prev) => prev.filter((f) => f.id !== fund.id))
  }

  const filtered = funds.filter((f) => {
    const matchesType = typeFilter === "all" || f.fund_type === typeFilter
    const q = search.toLowerCase()
    const matchesSearch = !q || (f.name ?? "").toLowerCase().includes(q) || (f._currency?.code ?? "").toLowerCase().includes(q)
    return matchesType && matchesSearch
  })

  const totalAum = funds.reduce((sum, f) => sum + (f.aum ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Funds</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {funds.length} fund{funds.length !== 1 ? "s" : ""} managed
            {totalAum > 0 && (
              <> · Total AUM {formatAum(totalAum, "USD")}</>
            )}
          </p>
        </div>
        <CreateFundDialog
          assetManagerId={assetManagerId}
          onCreated={(fund) => setFunds((prev) => [fund, ...prev])}
          defaultCurrency={defaultCurrency}
          defaultCountry={defaultCountry}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search funds…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FUND_TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                typeFilter === f.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fund list */}
      {filtered.length === 0 ? (
        <div className="border rounded-lg py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {funds.length === 0 ? "No funds yet. Create one to get started." : "No funds match your filters."}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {filtered.map((fund) => (
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
                  {fund._country && (
                    <span className="text-xs text-muted-foreground">{fund._country.name}</span>
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
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  disabled={deletingId === fund.id}
                  onClick={() => handleDelete(fund)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
                <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                  <Link href={`/asset-manager/${assetManagerId}/fund/${fund.id}`}>
                    Open
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
