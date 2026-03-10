"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPeriodDate } from "@/lib/return-profile-periods"
import { formatAmountWithCurrency } from "@/lib/entity-transactions"

type RawEntry = Record<string, unknown>

interface ReturnProfileLedgerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profileId: string
  profileName: string | null
  assetId: string
  periodStart: Date
  periodEnd: Date
}

export function ReturnProfileLedgerDialog({
  open,
  onOpenChange,
  profileId,
  profileName,
  assetId,
  periodStart,
  periodEnd,
}: ReturnProfileLedgerDialogProps) {
  const [entries, setEntries] = React.useState<RawEntry[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(
      `/api/transaction-entries?source=return_profile&source_id=${encodeURIComponent(profileId)}&object_id=${encodeURIComponent(assetId)}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((data: { entries?: unknown[] }) => {
        const raw = Array.isArray(data.entries) ? data.entries as RawEntry[] : []
        // Filter to entries whose transaction date falls within the period
        const filtered = raw.filter((e) => {
          const tx = e._transaction as Record<string, unknown> | undefined
          const date = typeof tx?.date === "number" ? tx.date : 0
          if (!date) return false
          const d = new Date(date)
          return d >= periodStart && d <= periodEnd
        })
        setEntries(filtered)
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [open, profileId, assetId, periodStart.getTime(), periodEnd.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  const periodLabel = `${formatPeriodDate(periodStart)} to ${formatPeriodDate(periodEnd)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Return Profile Ledger</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {profileName ?? "Profile"} · {periodLabel}
          </p>
        </DialogHeader>

        <div className="mt-2">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
              No transaction entries linked to this return profile in the selected period.
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide">Direction</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((e, i) => {
                    const tx = e._transaction as Record<string, unknown> | undefined
                    const date = typeof tx?.date === "number" ? new Date(tx.date) : null
                    const currency = e._currency as Record<string, unknown> | undefined
                    const code = typeof currency?.code === "string" ? currency.code : null
                    const amount = typeof e.amount === "number" ? e.amount : 0
                    const direction = e.direction as string
                    const entryType = typeof e.entry_type === "string" ? e.entry_type : "—"
                    const txRef = typeof tx?.reference === "string" ? tx.reference : null
                    return (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">
                          {date
                            ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 capitalize">{entryType.replace("_", " ")}</td>
                        <td className="px-3 py-2">
                          <span className={direction === "in" ? "text-emerald-600" : "text-rose-600"}>
                            {direction === "in" ? "In" : "Out"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {direction === "out" && <span className="text-muted-foreground">−</span>}
                          {formatAmountWithCurrency(amount, code)}
                          {txRef && <div className="text-muted-foreground font-sans font-normal truncate max-w-[140px] ml-auto">{txRef}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
