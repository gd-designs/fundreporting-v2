"use client"

import { Loader2 } from "lucide-react"
import type { LedgerRow } from "@/lib/period-ledger"

function fmt(value: number | null | undefined, currencyCode: string | null): string {
  if (value == null) return "—"
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode ?? "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return value.toFixed(2)
  }
}

function pct(value: number | null | undefined): string {
  if (value == null) return "—"
  return `${value.toFixed(2)}%`
}

function dateStr(ms: number | null | undefined): string {
  if (!ms) return "—"
  // Display in local timezone, not UTC, to match how dates are stored.
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function unitsStr(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 5 })
}

export function PeriodOverviewLedger({
  rows,
  currencyCode,
  loading,
  error,
}: {
  rows: LedgerRow[]
  currencyCode: string | null
  loading?: boolean
  error?: string | null
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Loading period ledger…
      </div>
    )
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No periods recorded yet for this fund.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-emerald-950 text-emerald-50">
          <tr>
            <th className="px-2 py-2 text-left font-medium">#</th>
            <th className="px-2 py-2 text-left font-medium">Period</th>
            <th className="px-2 py-2 text-right font-medium">Units</th>
            <th className="px-2 py-2 text-right font-medium">Gross NAV</th>
            <th className="px-2 py-2 text-right font-medium">Gross Value</th>
            <th className="px-2 py-2 text-right font-medium">Gross Return</th>
            <th className="px-2 py-2 text-right font-medium">Fees</th>
            <th className="px-2 py-2 text-right font-medium">Net NAV</th>
            <th className="px-2 py-2 text-right font-medium">Net Value</th>
            <th className="px-2 py-2 text-right font-medium">Net Return</th>
            <th className="px-2 py-2 text-right font-medium">Net Mutation</th>
            <th className="px-2 py-2 text-right font-medium">Cum. Mutation</th>
            <th className="px-2 py-2 text-right font-medium">Cum. Value</th>
            <th className="px-2 py-2 text-right font-medium">Cum. Return</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.kind === "initial") {
              return (
                <tr key={`init-${i}`} className="border-b last:border-b-0 bg-muted/20">
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2 font-medium">Initial Investment</td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">{fmt(row.grossValue, currencyCode)}</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">{fmt(row.netValue, currencyCode)}</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                </tr>
              )
            }

            if (row.kind === "distribution") {
              return (
                <tr key={`dist-${row.mutation.id}`} className="border-b last:border-b-0 bg-amber-50/40 dark:bg-amber-950/20">
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2 font-medium">{row.label}</td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">{fmt(row.amount, currencyCode)}</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">{fmt(row.amount, currencyCode)}</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                </tr>
              )
            }

            if (row.kind === "subscription" || row.kind === "redemption") {
              const isRed = row.kind === "redemption"
              const sign = isRed ? "−" : "+"
              const tone = isRed
                ? "bg-rose-50/40 dark:bg-rose-950/20"
                : "bg-emerald-50/40 dark:bg-emerald-950/20"
              return (
                <tr key={`sub-${row.mutation.id}`} className={`border-b last:border-b-0 ${tone}`}>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2 font-medium">{row.label}</td>
                  <td className="px-2 py-2 text-right">{sign}{unitsStr(row.shares)}</td>
                  <td className="px-2 py-2 text-right">{fmt(row.navPerShare, currencyCode)}</td>
                  <td className="px-2 py-2 text-right">{sign}{fmt(row.amount, currencyCode)}</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">{fmt(row.navPerShare, currencyCode)}</td>
                  <td className="px-2 py-2 text-right">{sign}{fmt(row.amount, currencyCode)}</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                </tr>
              )
            }

            if (row.kind !== "period") return null
            // period row
            const r = row
            return (
              <tr key={`p-${r.period.id}`} className="border-b last:border-b-0 align-top">
                <td className="px-2 py-2 font-medium">{r.index}</td>
                <td className="px-2 py-2">
                  <div className="font-medium">{dateStr(r.period.closed_at)}</div>
                  <div className="text-muted-foreground">{dateStr(r.period.opened_at)}</div>
                </td>
                <td className="px-2 py-2 text-right">
                  <div className="font-medium">{unitsStr(r.unitsClose)}</div>
                  <div className="text-muted-foreground">{unitsStr(r.unitsOpen)}</div>
                </td>
                <td className="px-2 py-2 text-right">
                  <div className="font-medium">{fmt(r.grossNavClose, currencyCode)}</div>
                  <div className="text-muted-foreground">{fmt(r.grossNavOpen, currencyCode)}</div>
                </td>
                <td className="px-2 py-2 text-right">
                  <div className="font-medium">{fmt(r.grossValueClose, currencyCode)}</div>
                  <div className="text-muted-foreground">{fmt(r.grossValueOpen, currencyCode)}</div>
                </td>
                <td className="px-2 py-2 text-right">
                  <div>{fmt(r.grossReturnAbs, currencyCode)}</div>
                  <div className="text-muted-foreground">{pct(r.grossReturnPct)}</div>
                </td>
                <td className="px-2 py-2 text-right">
                  <div>{fmt(r.feeTotal, currencyCode)}</div>
                  <div className="text-muted-foreground">{fmt(r.feePerUnit, currencyCode)} per unit</div>
                </td>
                <td className="px-2 py-2 text-right">
                  <div className="font-medium">{fmt(r.netNavClose, currencyCode)}</div>
                  <div className="text-muted-foreground">{fmt(r.netNavOpen, currencyCode)}</div>
                </td>
                <td className="px-2 py-2 text-right">
                  <div className="font-medium">{fmt(r.netValueClose, currencyCode)}</div>
                  <div className="text-muted-foreground">{fmt(r.netValueOpen, currencyCode)}</div>
                </td>
                <td className="px-2 py-2 text-right">{pct(r.netReturnPct)}</td>
                <td className="px-2 py-2 text-right">{fmt(r.netMutation, currencyCode)}</td>
                <td className="px-2 py-2 text-right">{fmt(r.cumMutation, currencyCode)}</td>
                <td className="px-2 py-2 text-right">{fmt(r.cumValue, currencyCode)}</td>
                <td className="px-2 py-2 text-right">{pct(r.cumReturnPct)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
