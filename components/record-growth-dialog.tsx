"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { DatePickerInput } from "@/components/date-input"
import type { ReturnProfile } from "@/lib/return-profiles"
import { formatPeriodDate } from "@/lib/return-profile-periods"
import { formatAmountWithCurrency } from "@/lib/entity-transactions"

interface RecordGrowthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string
  assetName: string
  entityId: string
  profile: ReturnProfile
  periodStart: Date
  periodEnd: Date
  recordingDate: Date
  expectedGrowth: number
  assetValue: number
  currencyCode: string
  onRecorded: () => void
}

export function RecordGrowthDialog({
  open,
  onOpenChange,
  assetId,
  assetName,
  entityId,
  profile,
  periodStart,
  periodEnd,
  recordingDate,
  expectedGrowth,
  assetValue,
  currencyCode,
  onRecorded,
}: RecordGrowthDialogProps) {
  const [date, setDate] = React.useState<Date | undefined>(recordingDate)
  // Three linked inputs — any one drives the other two
  const [amountStr, setAmountStr] = React.useState("")
  const [percentStr, setPercentStr] = React.useState("")
  const [newValueStr, setNewValueStr] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setDate(recordingDate)
    const delta = expectedGrowth > 0 ? expectedGrowth : 0
    setAmountStr(delta > 0 ? delta.toFixed(2) : "")
    if (assetValue > 0 && delta > 0) {
      setPercentStr(((delta / assetValue) * 100).toFixed(4))
      setNewValueStr((assetValue + delta).toFixed(2))
    } else {
      setPercentStr("")
      setNewValueStr(assetValue > 0 ? assetValue.toFixed(2) : "")
    }
    setNotes("")
    setError(null)
  }, [open, profile.id, periodStart.getTime(), expectedGrowth, assetValue]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAmountChange(val: string) {
    setAmountStr(val)
    const delta = parseFloat(val)
    if (Number.isFinite(delta) && assetValue > 0) {
      setPercentStr(((delta / assetValue) * 100).toFixed(4))
      setNewValueStr((assetValue + delta).toFixed(2))
    }
  }

  function handlePercentChange(val: string) {
    setPercentStr(val)
    const pct = parseFloat(val)
    if (Number.isFinite(pct) && assetValue > 0) {
      const delta = assetValue * (pct / 100)
      setAmountStr(delta.toFixed(2))
      setNewValueStr((assetValue + delta).toFixed(2))
    }
  }

  function handleNewValueChange(val: string) {
    setNewValueStr(val)
    const nv = parseFloat(val)
    if (Number.isFinite(nv) && assetValue > 0) {
      const delta = nv - assetValue
      setAmountStr(delta.toFixed(2))
      setPercentStr(((delta / assetValue) * 100).toFixed(4))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const delta = parseFloat(amountStr)
    if (!Number.isFinite(delta) || delta === 0) {
      setError("Enter a valid growth amount.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/mutations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: assetId,
          entity: entityId,
          date: date?.getTime() ?? Date.now(),
          delta,
          source: "return_profile",
          source_id: profile.id,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      onRecorded()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record growth.")
    } finally {
      setSaving(false)
    }
  }

  const periodLabel = `${formatPeriodDate(periodStart)} – ${formatPeriodDate(periodEnd)}`
  const method = profile.method ?? "compound"
  const deltaPreview = parseFloat(amountStr)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Growth</DialogTitle>
          <DialogDescription>
            Record compounding growth for this period. Creates a value mutation on the asset.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Asset</Label>
              <Input value={assetName} readOnly className="bg-muted/40" />
            </div>
            <div className="space-y-1.5">
              <Label>Return profile</Label>
              <Input value={profile.name ?? "—"} readOnly className="bg-muted/40" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Period</Label>
            <Input value={periodLabel} readOnly className="bg-muted/40" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DatePickerInput
              id="rg-date"
              label="Recording date"
              value={date}
              onChange={setDate}
            />
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Input value={method.charAt(0).toUpperCase() + method.slice(1)} readOnly className="bg-muted/40 capitalize" />
            </div>
          </div>

          {expectedGrowth > 0 && (
            <div className="rounded-md bg-muted/40 border px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
              <span>Expected growth ({profile.rate}% {profile.frequency})</span>
              <span className="font-medium text-foreground tabular-nums">
                {formatAmountWithCurrency(expectedGrowth, currencyCode)}
              </span>
            </div>
          )}

          {/* Three linked growth inputs */}
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-xs text-muted-foreground">Enter growth as amount, percentage, or new total value — the others update automatically.</p>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="rg-amount" className="text-xs">Growth amount</Label>
                <Input
                  id="rg-amount"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => handleAmountChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rg-percent" className="text-xs">Growth %</Label>
                <Input
                  id="rg-percent"
                  type="number"
                  step="any"
                  placeholder="0.0000"
                  value={percentStr}
                  onChange={(e) => handlePercentChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rg-newval" className="text-xs">New total value</Label>
                <Input
                  id="rg-newval"
                  type="number"
                  step="any"
                  placeholder={assetValue > 0 ? assetValue.toFixed(2) : "0.00"}
                  value={newValueStr}
                  onChange={(e) => handleNewValueChange(e.target.value)}
                />
              </div>
            </div>

            {Number.isFinite(deltaPreview) && deltaPreview !== 0 && (
              <p className="text-xs text-muted-foreground">
                Mutation recorded:{" "}
                <span className={`font-medium tabular-nums ${deltaPreview >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {deltaPreview >= 0 ? "+" : ""}{formatAmountWithCurrency(deltaPreview, currencyCode)}
                </span>
                {assetValue > 0 && (
                  <span className="ml-1">
                    → new value{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {formatAmountWithCurrency(assetValue + deltaPreview, currencyCode)}
                    </span>
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rg-notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="rg-notes"
              placeholder="e.g. Quarterly revaluation"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner className="mr-2 size-3.5" />}
              Record growth
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
