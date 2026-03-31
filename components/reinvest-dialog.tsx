"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import { DatePickerInput } from "@/components/date-input"
import { Spinner } from "@/components/ui/spinner"
import type { CapTableEntry, CapTableShareholder, ShareClass } from "@/lib/cap-table"

type CurrencyOption = { id: number; name?: string | null; code?: string | null }

function fmtCcy(n: number, code: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(n)
  } catch {
    return String(n)
  }
}

export function ReinvestDialog({
  open,
  onClose,
  shareholder,
  entry,
  fundId,
  fundEntityUUID,
  shareClasses,
  currencyCode,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  shareholder: CapTableShareholder
  entry: CapTableEntry
  fundId?: string
  fundEntityUUID: string
  shareClasses: ShareClass[]
  currencyCode: string
  onSuccess: () => void
}) {
  const [amount, setAmount] = React.useState("")
  const [shareClassId, setShareClassId] = React.useState(entry.share_class ?? shareClasses[0]?.id ?? "")
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [entryFee, setEntryFee] = React.useState("0")
  const [markDeployed, setMarkDeployed] = React.useState(false)
  const [currencyId, setCurrencyId] = React.useState<number | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Load currency id matching currencyCode
  React.useEffect(() => {
    if (!open) return
    fetch("/api/currencies")
      .then((r) => r.ok ? r.json() : [])
      .then((data: CurrencyOption[]) => {
        const matched = data.find((c) => c.code?.toUpperCase() === currencyCode.toUpperCase())
        if (matched) setCurrencyId(matched.id)
      })
      .catch(() => {})
  }, [open, currencyCode])

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setAmount("")
      setShareClassId(entry.share_class ?? shareClasses[0]?.id ?? "")

      setDate(new Date())
      setEntryFee("0")
      setMarkDeployed(false)
      setError(null)
    }
  }, [open, shareClasses])

  const amountNum = Number(amount)
  const feeRate = Number(entryFee) / 100
  const feeAmount = amountNum * feeRate
  const grossWire = amountNum + feeAmount
  const selectedSc = shareClasses.find((sc) => sc.id === shareClassId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || amountNum <= 0) { setError("Amount is required."); return }
    if (!currencyId) { setError("Currency could not be resolved."); return }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/fund-reinvest-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: entry.id,
          fundShareholderId: shareholder.id,
          fundEntityUUID,
          shareClassId: shareClassId || undefined,
          callAmount: amountNum,
          subscriptionDate: date ? date.getTime() : Date.now(),
          entryFeeRateDecimal: feeRate > 0 ? feeRate : 0,
          markDeployed,
          currencyId,
          fundId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Failed to reinvest.")
      }
      onSuccess()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reinvest.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Reinvest</DialogTitle>
          </DialogHeader>

          <FieldGroup className="mt-4">

            {/* Shareholder — read-only */}
            <Field>
              <FieldLabel>Investor</FieldLabel>
              <div className="h-8 flex items-center px-2.5 rounded-lg border bg-muted/40 text-sm text-muted-foreground">
                {shareholder.name ?? "—"}
              </div>
            </Field>

            {/* Share class */}
            {shareClasses.length > 0 && (
              <Field>
                <FieldLabel>Share Class</FieldLabel>
                <Select value={shareClassId} onValueChange={setShareClassId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select share class…" />
                  </SelectTrigger>
                  <SelectContent>
                    {shareClasses.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.name ?? sc.id}
                        {sc.current_nav != null && ` — ${fmtCcy(sc.current_nav, currencyCode)}/share`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {/* Amount */}
            <Field>
              <FieldLabel>Reinvestment Amount ({currencyCode})</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>

            {/* Entry fee */}
            <Field>
              <FieldLabel>Entry Fee %</FieldLabel>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
              />
              {feeRate > 0 && amountNum > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Fee: {fmtCcy(feeAmount, currencyCode)} · Gross wire: {fmtCcy(grossWire, currencyCode)}
                </p>
              )}
            </Field>

            {/* Date */}
            <DatePickerInput
              id="reinvest-date"
              label="Date"
              value={date}
              onChange={setDate}
            />

            {/* Mark deployed */}
            <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border p-3 hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 rounded"
                checked={markDeployed}
                onChange={(e) => setMarkDeployed(e.target.checked)}
              />
              <div>
                <p className="text-sm font-medium">Mark as deployed</p>
                <p className="text-xs text-muted-foreground">
                  Tick this for historical records where capital was already deployed into a previous period.
                  Leave unticked to deploy via the period opening flow.
                </p>
              </div>
            </label>

            {/* Summary */}
            {amountNum > 0 && selectedSc?.current_nav && (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                <p>Shares (est.): <span className="font-medium text-foreground">{(amountNum / selectedSc.current_nav).toLocaleString("en-GB", { maximumFractionDigits: 4 })}</span></p>
                <p>@ {fmtCcy(selectedSc.current_nav, currencyCode)}/share</p>
              </div>
            )}

            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="size-4" /> : "Reinvest"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
