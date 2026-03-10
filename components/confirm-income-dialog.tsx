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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { DatePickerInput } from "@/components/date-input"
import type { ReturnProfile } from "@/lib/return-profiles"

type SimpleAsset = { id: string; name: string; currencyId: number | null; currencyCode: string | null }

interface ConfirmIncomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string
  assetName: string
  entityId: string
  profile: ReturnProfile
  periodStart: Date
  periodEnd: Date
  collectionDate: Date
  currencyId: number | null
  currencyCode: string
  onConfirmed: () => void
}

export function ConfirmIncomeDialog({
  open,
  onOpenChange,
  assetId,
  assetName,
  entityId,
  profile,
  collectionDate,
  currencyId,
  currencyCode,
  onConfirmed,
}: ConfirmIncomeDialogProps) {
  const [reference, setReference] = React.useState("")
  const [collDate, setCollDate] = React.useState<Date | undefined>(collectionDate)
  const [cashAssets, setCashAssets] = React.useState<SimpleAsset[]>([])
  const [cashAssetId, setCashAssetId] = React.useState("")
  const [actualIncome, setActualIncome] = React.useState("")
  const [costs, setCosts] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setReference(`Income from ${assetName} · ${profile.name ?? "return profile"}`)
    setCollDate(collectionDate)
    setActualIncome(profile.amount != null ? String(profile.amount) : "")
    setCosts("")
    setError(null)
  }, [open, profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!open) return
    fetch(`/api/assets?entity=${encodeURIComponent(entityId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<Record<string, unknown>>) => {
        const assets = data
          .filter((a) => typeof a.id === "string" && a.id !== assetId && a.investable === "investable_cash")
          .map((a) => {
            const cur = a._currency as Record<string, unknown> | undefined
            return {
              id: a.id as string,
              name: typeof a.name === "string" ? a.name : "Unnamed",
              currencyId: typeof cur?.id === "number" ? cur.id : null,
              currencyCode: typeof cur?.code === "string" ? cur.code : null,
            }
          })
        setCashAssets(assets)
        // Pre-select cash asset matching the income currency, else first
        const match = assets.find((a) => a.currencyId === currencyId) ?? assets[0]
        if (match) setCashAssetId(match.id)
      })
      .catch(() => {})
  }, [open, entityId, assetId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const income = parseFloat(actualIncome)
    const costsVal = parseFloat(costs) || 0
    if (!Number.isFinite(income) || income <= 0) {
      setError("Enter a valid income amount.")
      return
    }
    if (!cashAssetId) {
      setError("Select a cash destination asset.")
      return
    }

    const netAmount = income - costsVal
    const collDateMs = collDate?.getTime() ?? Date.now()

    setSaving(true)
    setError(null)
    try {
      // 1. Create transaction
      const txRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          created_by_entity: entityId,
          type: 7,
          date: collDateMs,
          reference: reference.trim() || undefined,
        }),
      })
      if (!txRes.ok) throw new Error(await txRes.text())
      const tx = (await txRes.json()) as { id: string }

      const postEntry = (body: object) =>
        fetch("/api/transaction-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then((r) => { if (!r.ok) throw new Error("Entry failed") })

      // 2a. Income IN to asset (gross, sourced from return profile)
      await postEntry({
        transaction: tx.id,
        entry_type: "income",
        entity: entityId,
        object_type: "asset",
        object_id: assetId,
        direction: "in",
        currency: currencyId,
        amount: income,
        source: "return_profile",
        source_id: profile.id,
      })

      // 2b. Expense OUT from asset for costs (if any)
      if (costsVal > 0) {
        await postEntry({
          transaction: tx.id,
          entry_type: "expense",
          entity: entityId,
          object_type: "asset",
          object_id: assetId,
          direction: "out",
          currency: currencyId,
          amount: costsVal,
          source: "return_profile",
          source_id: profile.id,
        })
      }

      // 2c. Asset OUT (net after costs)
      await postEntry({
        transaction: tx.id,
        entry_type: "asset",
        entity: entityId,
        object_type: "asset",
        object_id: assetId,
        direction: "out",
        currency: currencyId,
        amount: netAmount,
      })

      // 2d. Cash IN to destination
      await postEntry({
        transaction: tx.id,
        entry_type: "cash",
        entity: entityId,
        object_type: "asset",
        object_id: cashAssetId,
        direction: "in",
        currency: currencyId,
        amount: netAmount,
      })

      onConfirmed()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm income.")
    } finally {
      setSaving(false)
    }
  }

  const incomeNum = parseFloat(actualIncome) || 0
  const costsNum = parseFloat(costs) || 0
  const netDisplay = incomeNum - costsNum

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm Income</DialogTitle>
          <DialogDescription>
            Record actual income collected for this return period and post it into a cash asset.
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
            <Label htmlFor="ci-reference">Reference</Label>
            <Input
              id="ci-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DatePickerInput
              id="ci-date"
              label="Collection date"
              value={collDate}
              onChange={setCollDate}
            />
            <div className="space-y-1.5">
              <Label htmlFor="ci-cash">Cash destination</Label>
              <Select value={cashAssetId} onValueChange={setCashAssetId}>
                <SelectTrigger id="ci-cash" className="w-full">
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
                <SelectContent>
                  {cashAssets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}{a.currencyCode ? ` (${a.currencyCode})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ci-income">Actual income (gross)</Label>
              <Input
                id="ci-income"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={actualIncome}
                onChange={(e) => setActualIncome(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ci-costs">
                Costs / fees
                <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="ci-costs"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={costs}
                onChange={(e) => setCosts(e.target.value)}
              />
            </div>
          </div>

          {costsNum > 0 && (
            <div className="rounded-md bg-muted/40 border px-3 py-2 text-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Gross income</span>
                <span className="tabular-nums">{currencyCode} {incomeNum.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Less: costs / fees (expense entry)</span>
                <span className="tabular-nums text-destructive">− {currencyCode} {costsNum.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between font-medium text-foreground border-t pt-1 mt-1">
                <span>Net transfer to cash</span>
                <span className="tabular-nums">{currencyCode} {netDisplay.toFixed(2)}</span>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner className="mr-2 size-3.5" />}
              Confirm income
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
