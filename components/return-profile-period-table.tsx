"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmIncomeDialog } from "@/components/confirm-income-dialog"
import { ReturnProfileLedgerDialog } from "@/components/return-profile-ledger-dialog"
import { RecordGrowthDialog } from "@/components/record-growth-dialog"
import type { ReturnProfile } from "@/lib/return-profiles"
import {
  generatePeriodsForYear,
  fetchProfileEntries,
  sumTrueIncomeForPeriod,
  fetchProfileMutations,
  sumRecordedGrowthForPeriod,
  computeExpectedGrowth,
  formatPeriodDate,
  type Period,
  type RawMutation,
} from "@/lib/return-profile-periods"
import { formatAmountWithCurrency } from "@/lib/entity-transactions"

interface ReturnProfilePeriodTableProps {
  profile: ReturnProfile
  assetId: string
  assetName: string
  entityId: string
  currencyId: number | null
  currencyCode: string
  assetValue: number
  onLedgerChanged?: () => void
}

export function ReturnProfilePeriodTable({
  profile,
  assetId,
  assetName,
  entityId,
  currencyId,
  currencyCode,
  assetValue,
  onLedgerChanged,
}: ReturnProfilePeriodTableProps) {
  const currentYear = new Date().getFullYear()
  const [availableYears, setAvailableYears] = React.useState<number[]>([currentYear])
  const [year, setYear] = React.useState(currentYear)

  const yearIndex = availableYears.indexOf(year)
  const canPrev = yearIndex > 0
  const canNext = yearIndex < availableYears.length - 1

  function addYear() {
    const maxYear = Math.max(...availableYears)
    const next = maxYear + 1
    setAvailableYears((prev) => [...prev, next])
    setYear(next)
  }

  // Cash flow state
  const [rawEntries, setRawEntries] = React.useState<Array<Record<string, unknown>>>([])
  const [entriesLoading, setEntriesLoading] = React.useState(false)

  // Compounding state
  const [mutations, setMutations] = React.useState<RawMutation[]>([])
  const [mutationsLoading, setMutationsLoading] = React.useState(false)

  // Confirm income dialog state (cash flow)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [confirmPeriod, setConfirmPeriod] = React.useState<Period | null>(null)

  // Record growth dialog state (compounding)
  const [growthOpen, setGrowthOpen] = React.useState(false)
  const [growthPeriod, setGrowthPeriod] = React.useState<Period | null>(null)

  // Ledger dialog state
  const [ledgerOpen, setLedgerOpen] = React.useState(false)
  const [ledgerPeriod, setLedgerPeriod] = React.useState<Period | null>(null)

  // Load entries (cash flow) or mutations (compounding) when profile changes
  React.useEffect(() => {
    if (profile.type === "cash_flow") {
      setEntriesLoading(true)
      fetchProfileEntries(profile.id, assetId)
        .then((data) => setRawEntries(data as Array<Record<string, unknown>>))
        .catch(() => setRawEntries([]))
        .finally(() => setEntriesLoading(false))
    } else {
      setMutationsLoading(true)
      fetchProfileMutations(profile.id, assetId)
        .then(setMutations)
        .catch(() => setMutations([]))
        .finally(() => setMutationsLoading(false))
    }
  }, [profile.id, profile.type, assetId])

  const periodsForYear = React.useMemo(
    () => generatePeriodsForYear(profile, year),
    [profile, year]
  )

  function openConfirm(period: Period) {
    setConfirmPeriod(period)
    setConfirmOpen(true)
  }

  function openGrowth(period: Period) {
    setGrowthPeriod(period)
    setGrowthOpen(true)
  }

  function openLedger(period: Period) {
    setLedgerPeriod(period)
    setLedgerOpen(true)
  }

  function reloadData() {
    if (profile.type === "cash_flow") {
      fetchProfileEntries(profile.id, assetId)
        .then((data) => setRawEntries(data as Array<Record<string, unknown>>))
        .catch(() => {})
    } else {
      fetchProfileMutations(profile.id, assetId)
        .then(setMutations)
        .catch(() => {})
    }
    onLedgerChanged?.()
  }

  const isCompounding = profile.type === "compounding"
  const isLoading = isCompounding ? mutationsLoading : entriesLoading

  const periods = periodsForYear
  const yExpected = periods.reduce(
    (s, p) => s + (isCompounding
      ? computeExpectedGrowth(profile, p.periodStart, assetValue, mutations)
      : p.expectedAmount),
    0
  )
  const yRecorded = isCompounding
    ? periods.reduce((s, p) => s + sumRecordedGrowthForPeriod(mutations, p.periodStart, p.periodEnd), 0)
    : periods.reduce((s, p) => s + sumTrueIncomeForPeriod(rawEntries, p.periodStart, p.periodEnd), 0)

  return (
    <div className="space-y-4">
      {/* Year navigation */}
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setYear(availableYears[yearIndex - 1]!)} disabled={!canPrev}>
          <ChevronLeft className="size-3.5" />
          Previous
        </Button>
        <div className="flex items-center gap-1 flex-1 justify-center">
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                y === year ? "border-foreground bg-muted" : "border-border hover:border-muted-foreground text-muted-foreground"
              }`}
            >
              {y}
            </button>
          ))}
          <Button size="sm" variant="ghost" className="h-7 w-7 px-0" onClick={addYear} title="Add next year">
            <Plus className="size-3.5" />
          </Button>
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setYear(availableYears[yearIndex + 1]!)} disabled={!canNext}>
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      {/* Single period table */}
      {(() => {
        return (
          <div className="rounded-md border overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 border-b">
              <p className="text-xs font-semibold">{profile.name ?? "Return Profile"} · {year}</p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Period</th>
                  {isCompounding ? (
                    <>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Recording Date</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Expected Growth</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Recorded Growth</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Collection</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Expected Income</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">True Income</th>
                    </>
                  )}
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {periods.map((period, i) => {
                  const expectedGrowth = isCompounding
                    ? computeExpectedGrowth(profile, period.periodStart, assetValue, mutations)
                    : period.expectedAmount
                  const recordedGrowth = isCompounding
                    ? sumRecordedGrowthForPeriod(mutations, period.periodStart, period.periodEnd)
                    : sumTrueIncomeForPeriod(rawEntries, period.periodStart, period.periodEnd)

                  return (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        {formatPeriodDate(period.periodStart)} – {formatPeriodDate(period.periodEnd)}
                      </td>
                      {isCompounding ? (
                        <>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatPeriodDate(period.collectionDate)}
                          </td>
                          <td className="px-4 py-3">
                            {formatAmountWithCurrency(expectedGrowth, currencyCode)}
                          </td>
                          <td className="px-4 py-3">
                            {isLoading ? (
                              <span className="text-muted-foreground">…</span>
                            ) : (
                              <span className={recordedGrowth > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                                {formatAmountWithCurrency(recordedGrowth, currencyCode)}
                              </span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatPeriodDate(period.collectionDate)}
                          </td>
                          <td className="px-4 py-3">
                            {formatAmountWithCurrency(expectedGrowth, currencyCode)}
                          </td>
                          <td className="px-4 py-3">
                            {isLoading ? (
                              <span className="text-muted-foreground">…</span>
                            ) : (
                              <span className={recordedGrowth > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                                {formatAmountWithCurrency(recordedGrowth, currencyCode)}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => isCompounding ? openGrowth(period) : openConfirm(period)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title={isCompounding ? "Record growth" : "Confirm income"}
                          >
                            <Plus className="size-3.5" />
                          </button>
                          <button
                            onClick={() => openLedger(period)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                          >
                            {isCompounding ? "Mut" : "Tx"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {periods.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No periods in {year} for this profile.
                    </td>
                  </tr>
                )}
              </tbody>
              {periods.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Totals</td>
                    <td />
                    <td className="px-4 py-2">{formatAmountWithCurrency(yExpected, currencyCode)}</td>
                    <td className="px-4 py-2">
                      <span className={yRecorded > 0 ? "text-emerald-600" : "text-muted-foreground"}>
                        {formatAmountWithCurrency(yRecorded, currencyCode)}
                      </span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )
      })()}

      {/* Confirm income dialog (cash flow) */}
      {!isCompounding && confirmPeriod && (
        <ConfirmIncomeDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          assetId={assetId}
          assetName={assetName}
          entityId={entityId}
          profile={profile}
          periodStart={confirmPeriod.periodStart}
          periodEnd={confirmPeriod.periodEnd}
          collectionDate={confirmPeriod.collectionDate}
          currencyId={currencyId}
          currencyCode={currencyCode}
          onConfirmed={reloadData}
        />
      )}

      {/* Record growth dialog (compounding) */}
      {isCompounding && growthPeriod && (
        <RecordGrowthDialog
          open={growthOpen}
          onOpenChange={setGrowthOpen}
          assetId={assetId}
          assetName={assetName}
          entityId={entityId}
          profile={profile}
          periodStart={growthPeriod.periodStart}
          periodEnd={growthPeriod.periodEnd}
          recordingDate={growthPeriod.collectionDate}
          expectedGrowth={computeExpectedGrowth(profile, growthPeriod.periodStart, assetValue, mutations)}
          assetValue={assetValue}
          currencyCode={currencyCode}
          onRecorded={reloadData}
        />
      )}

      {/* Ledger dialog */}
      {ledgerPeriod && (
        <ReturnProfileLedgerDialog
          open={ledgerOpen}
          onOpenChange={setLedgerOpen}
          profileId={profile.id}
          profileName={profile.name}
          assetId={assetId}
          periodStart={ledgerPeriod.periodStart}
          periodEnd={ledgerPeriod.periodEnd}
        />
      )}
    </div>
  )
}
