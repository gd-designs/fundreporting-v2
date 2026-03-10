"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreateFundDialog, FUND_TYPES, type CreatedFund } from "@/components/create-fund-dialog"

type Fund = CreatedFund

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

export function AssetManagerOverview({
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

  async function handleDelete(fund: Fund) {
    if (!window.confirm(`Delete "${fund.name ?? "this fund"}"? This cannot be undone.`)) return
    setDeletingId(fund.id)
    const res = await fetch(`/api/funds/${fund.id}`, { method: "DELETE" })
    setDeletingId(null)
    if (res.ok) setFunds((prev) => prev.filter((f) => f.id !== fund.id))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Funds</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Funds managed by this asset manager.</p>
        </div>
        <CreateFundDialog
          assetManagerId={assetManagerId}
          onCreated={(fund) => setFunds((prev) => [fund, ...prev])}
          defaultCurrency={defaultCurrency}
          defaultCountry={defaultCountry}
        />
      </div>

      {funds.length === 0 ? (
        <div className="border rounded-lg py-16 text-center">
          <p className="text-sm text-muted-foreground">No funds yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {funds.map((fund) => (
            <div key={fund.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-sm">{fund.name ?? "Unnamed fund"}</span>
                <div className="flex items-center gap-2">
                  {fund.fund_type && (
                    <Badge variant="secondary" className="text-xs capitalize">
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
                    <span className="text-xs text-muted-foreground">
                      AUM {formatAum(fund.aum, fund._currency?.code)}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                disabled={deletingId === fund.id}
                onClick={() => handleDelete(fund)}
              >
                <Trash2 className="size-3.5" />
              </Button>
              <Button variant="ghost" size="sm" asChild>
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
  )
}
