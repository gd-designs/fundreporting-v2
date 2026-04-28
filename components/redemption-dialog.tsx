"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePickerInput } from "@/components/date-input"

type CashAsset = {
  id: string
  name: string
  currencyCode: string
}

type Props = {
  children: React.ReactNode
  entityUUID: string
  assetId: string
  assetName: string
  cashAssets: CashAsset[]
  defaultCurrencyId?: number
  onSuccess: () => void
}

export function RedemptionDialog({
  children,
  entityUUID,
  assetId,
  assetName,
  cashAssets,
  defaultCurrencyId,
  onSuccess,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [amount, setAmount] = React.useState("")
  const [cashAssetId, setCashAssetId] = React.useState(cashAssets[0]?.id ?? "")
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [reference, setReference] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [redemptionTypeId, setRedemptionTypeId] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (open) {
      setAmount("")
      setCashAssetId(cashAssets[0]?.id ?? "")
      setDate(new Date())
      setReference("")
      setNotes("")
      setError(null)
      fetch("/api/transaction-types")
        .then((r) => (r.ok ? r.json() : []))
        .then((list: Array<{ id: number; name?: string | null }>) => {
          const match = list.find((t) => t.name?.toLowerCase() === "redemption")
          if (match) setRedemptionTypeId(match.id)
        })
        .catch(() => {})
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCash = cashAssets.find((c) => c.id === cashAssetId)
  const parsedAmount = parseFloat(amount) || 0

  async function handleSubmit() {
    if (parsedAmount <= 0) { setError("Amount must be positive."); return }
    if (!cashAssetId) { setError("Select a cash account."); return }
    setSaving(true)
    setError(null)
    try {
      const txRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          created_by_entity: entityUUID,
          date: date ? date.getTime() : Date.now(),
          ...(redemptionTypeId != null ? { type: redemptionTypeId } : {}),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      })
      if (!txRes.ok) throw new Error("Failed to create transaction")
      const tx = (await txRes.json()) as { id: string }

      // Entry 1: Asset OUT (redemption leaving the asset)
      await fetch("/api/transaction-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: tx.id,
          entity: entityUUID,
          entry_type: "asset",
          object_type: "asset",
          object_id: assetId,
          direction: "out",
          currency: defaultCurrencyId ?? null,
          amount: parsedAmount,
          source: "asset",
          source_id: cashAssetId,
        }),
      })

      // Entry 2: Cash IN (redemption proceeds)
      await fetch("/api/transaction-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: tx.id,
          entity: entityUUID,
          entry_type: "cash",
          object_type: "asset",
          object_id: cashAssetId,
          direction: "in",
          currency: defaultCurrencyId ?? null,
          amount: parsedAmount,
          source: "asset",
          source_id: assetId,
        }),
      })

      onSuccess()
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record redemption")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>
        {children}
      </div>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record redemption</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Redeem value from <span className="font-medium text-foreground">{assetName}</span> back to cash.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="grid gap-2">
            <Label htmlFor="red-amount">Amount</Label>
            <Input
              id="red-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {cashAssets.length > 1 && (
            <div className="grid gap-2">
              <Label>Receive into</Label>
              <Select value={cashAssetId} onValueChange={setCashAssetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cash account…" />
                </SelectTrigger>
                <SelectContent>
                  {cashAssets.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.currencyCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {cashAssets.length === 1 && selectedCash && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Receive into</span>
                <span className="font-medium">{selectedCash.name} ({selectedCash.currencyCode})</span>
              </div>
            </div>
          )}

          <DatePickerInput id="red-date" label="Date" value={date} onChange={setDate} />

          <div className="grid gap-2">
            <Label htmlFor="red-ref">Reference <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="red-ref"
              placeholder="e.g. Partial redemption"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="red-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <textarea
              id="red-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes…"
              className="border-input bg-background min-h-16 rounded-md border px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || parsedAmount <= 0}>
            {saving ? "Recording…" : "Record redemption"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
