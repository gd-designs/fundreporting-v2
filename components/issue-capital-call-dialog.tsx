"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePickerInput } from "@/components/date-input"
import type { CapitalCall } from "@/lib/cap-table"

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

export function IssueCapitalCallDialog({
  open,
  onOpenChange,
  fundEntityId,
  fundEntryId,
  fundName,
  committedAmount,
  alreadyCalled,
  shareClassId,
  onIssued,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  fundEntityId: string
  fundEntryId: string
  fundName: string
  committedAmount: number | null
  alreadyCalled: number
  shareClassId?: string | null
  onIssued: (call: CapitalCall) => void
}) {
  const remaining = (committedAmount ?? 0) - alreadyCalled
  const [amount, setAmount] = React.useState("")
  const [dueDate, setDueDate] = React.useState<Date | undefined>(undefined)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setAmount(remaining > 0 ? String(remaining) : "")
      setDueDate(undefined)
      setError(null)
    }
  }, [open, remaining])

  const parsedAmount = parseFloat(amount)
  const canSubmit = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= (committedAmount ?? Infinity)

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/capital-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: fundEntityId,
          cap_table_entry: fundEntryId,
          amount: parsedAmount,
          share_class: shareClassId ?? undefined,
          due_date: dueDate ? dueDate.getTime() : undefined,
          called_at: Date.now(),
          status: "pending",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to issue capital call")

      const call = data as CapitalCall

      // Create notification + task in parallel (fire-and-forget)
      const dueDateStr = dueDate ? `, due ${dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""
      void Promise.all([
        fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "capital_call",
            resource_id: call.id,
            title: `Capital call issued — ${fundName}`,
            body: `${fmt(parsedAmount)} called${dueDateStr}`,
            read: false,
          }),
        }),
        fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Chase capital call payment — ${fundName}`,
            description: `${fmt(parsedAmount)} called${dueDateStr}. Follow up with investor to confirm receipt.`,
            status: "todo",
            priority: "medium",
            due_date: dueDate ? dueDate.getTime() : undefined,
            entity: fundEntityId,
            object_type: "capital_call",
            object_id: call.id,
          }),
        }),
      ])

      onIssued(call)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Issue capital call</DialogTitle>
          <DialogDescription>{fundName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm grid grid-cols-2 gap-y-1">
            <span className="text-muted-foreground">Total committed</span>
            <span className="text-right font-medium">{fmt(committedAmount)}</span>
            <span className="text-muted-foreground">Already called</span>
            <span className="text-right font-medium">{fmt(alreadyCalled)}</span>
            <span className="text-muted-foreground font-medium">Remaining uncalled</span>
            <span className="text-right font-medium">{fmt(remaining)}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="call-amount">Call amount</Label>
            <Input
              id="call-amount"
              type="number"
              min="0"
              step="any"
              max={committedAmount ?? undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
            {remaining > 0 && (
              <p className="text-xs text-muted-foreground">Max: {fmt(remaining)} remaining uncalled</p>
            )}
          </div>

          <DatePickerInput
            label="Due date (optional)"
            value={dueDate}
            onChange={setDueDate}
            placeholder="Select due date…"
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
              {saving ? <><Loader2 className="size-4 animate-spin" /> Issuing…</> : "Issue call"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
