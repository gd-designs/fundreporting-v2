"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DateTimePickerInput } from "@/components/date-time-input"
import { createMutation } from "@/lib/mutations"
import { formatCurrency } from "@/lib/entity-assets"

type Props = {
  children: React.ReactNode
  entityId: string
  assetId: string
  assetName: string
  currentValue: number
  currencyCode: string
  onSuccess: () => void
}

export function RevalueDialog({
  children,
  entityId,
  assetId,
  assetName,
  currentValue,
  currencyCode,
  onSuccess,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [newValue, setNewValue] = React.useState("")
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [notes, setNotes] = React.useState("")

  const parsedNewValue = parseFloat(newValue)
  const delta = Number.isFinite(parsedNewValue) ? parsedNewValue - currentValue : null
  const deltaUp = delta !== null && delta >= 0

  function reset() {
    setNewValue("")
    setDate(new Date())
    setNotes("")
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (delta === null) return
    setSaving(true)
    setError(null)
    try {
      await createMutation({
        entity: entityId,
        asset: assetId,
        date: (date ?? new Date()).getTime(),
        delta,
        source: null,
        notes: notes.trim() || undefined,
      })
      onSuccess()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save revaluation.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revalue — {assetName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Current value banner */}
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Current value: </span>
            <span className="font-medium">{formatCurrency(currentValue, currencyCode)}</span>
          </div>

          {/* New value */}
          <div className="space-y-1.5">
            <Label htmlFor="revalue-new-value">New value</Label>
            <Input
              id="revalue-new-value"
              type="number"
              step="any"
              placeholder="0.00"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              required
            />
            {delta !== null && (
              <p className={`text-xs font-medium ${deltaUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                {deltaUp ? "+" : "−"}{formatCurrency(Math.abs(delta), currencyCode)} adjustment
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Valuation date</Label>
            <DateTimePickerInput value={date} onChange={setDate} />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="revalue-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="revalue-notes"
              placeholder="e.g. Q1 2026 appraisal"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || delta === null || delta === 0}>
              {saving ? "Saving…" : "Save revaluation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
