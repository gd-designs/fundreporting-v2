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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { DatePickerInput } from "@/components/date-input"
import { createReturnProfile, type ReturnProfileType, type ReturnProfileFrequency, type ReturnProfileMethod, type ReturnProfile } from "@/lib/return-profiles"
import { cn } from "@/lib/utils"

type Currency = { id: number; code: string; name: string }

const FREQUENCIES: { value: ReturnProfileFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "bi-annually", label: "Bi-annually" },
  { value: "annually", label: "Annually" },
]

interface AddReturnProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string
  assetCurrencyId?: number | null
  onCreated: (profile: ReturnProfile) => void
}

export function AddReturnProfileDialog({ open, onOpenChange, assetId, assetCurrencyId, onCreated }: AddReturnProfileDialogProps) {
  const [type, setType] = React.useState<ReturnProfileType>("cash_flow")
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [startDate, setStartDate] = React.useState<Date | undefined>(new Date())
  const [endDate, setEndDate] = React.useState<Date | undefined>(undefined)
  const [ongoing, setOngoing] = React.useState(true)
  const [frequency, setFrequency] = React.useState<ReturnProfileFrequency>("monthly")
  // cash_flow fields
  const [amount, setAmount] = React.useState("")
  const [currencyId, setCurrencyId] = React.useState("")
  const [collectionDate, setCollectionDate] = React.useState<Date | undefined>(new Date())
  // compounding fields
  const [rate, setRate] = React.useState("")
  const [method, setMethod] = React.useState<ReturnProfileMethod>("compound")
  const [overrideAmount, setOverrideAmount] = React.useState("")
  const [growthRecordingDate, setGrowthRecordingDate] = React.useState<Date | undefined>(new Date())

  const [currencies, setCurrencies] = React.useState<Currency[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    fetch("/api/currencies")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Currency[]) => {
        setCurrencies(data)
        // Always preset currency on open
        const preset = assetCurrencyId ? data.find((c) => c.id === assetCurrencyId) : data[0]
        if (preset) setCurrencyId(String(preset.id))
        else if (data[0]) setCurrencyId(String(data[0].id))
      })
      .catch(() => {})
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    setType("cash_flow")
    setName("")
    setDescription("")
    setStartDate(new Date())
    setEndDate(undefined)
    setOngoing(true)
    setFrequency("monthly")
    setAmount("")
    setCurrencyId("")
    setCollectionDate(new Date())
    setRate("")
    setMethod("compound")
    setOverrideAmount("")
    setGrowthRecordingDate(new Date())
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (type === "cash_flow" && !amount) { setError("Amount per period is required."); return }
    if (type === "compounding" && !rate) { setError("Growth rate is required."); return }

    setSaving(true)
    setError(null)
    try {
      const profile = await createReturnProfile({
        asset: assetId,
        name: name || undefined,
        description: description || undefined,
        type,
        frequency,
        start: startDate?.getTime(),
        end: ongoing ? undefined : endDate?.getTime(),
        amount: amount ? parseFloat(amount) : undefined,
        currency: currencyId ? parseInt(currencyId) : undefined,
        collection: type === "cash_flow" ? collectionDate?.getTime() : growthRecordingDate?.getTime(),
        rate: type === "compounding" && rate ? parseFloat(rate) : undefined,
        method: type === "compounding" ? method : undefined,
      })
      onCreated(profile)
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create return profile.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add return profile</DialogTitle>
          <DialogDescription>Define income cash flow or value-growth compounding for this asset.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Return model selector */}
          <div className="space-y-1.5">
            <Label className="text-sm">Return model</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "cash_flow", label: "Cash Flow (Income)", sub: "Regular distributions paid out as income." },
                { value: "compounding", label: "Compounding (Value Growth)", sub: "Returns reinvested to increase value over time." },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "flex flex-col items-start rounded-md border p-3 text-left text-sm transition-colors",
                    type === opt.value
                      ? "border-foreground bg-muted font-medium"
                      : "border-border hover:border-muted-foreground"
                  )}
                >
                  <span className="font-medium text-sm">{opt.label}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Profile name */}
          <div className="space-y-1.5">
            <Label htmlFor="rp-name">Profile name</Label>
            <Input
              id="rp-name"
              placeholder={type === "cash_flow" ? "e.g. Rental Income 2026" : "e.g. Annual Growth 2026"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="rp-description">Description</Label>
            <Textarea
              id="rp-description"
              placeholder="Optional context for this return profile."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Start + End date */}
          <div className="grid grid-cols-2 gap-3">
            <DatePickerInput
              id="rp-start"
              label="Start date"
              value={startDate}
              onChange={setStartDate}
            />
            <div className={ongoing ? "opacity-50 pointer-events-none" : ""}>
              <DatePickerInput
                id="rp-end"
                label="End date"
                value={endDate}
                onChange={setEndDate}
                placeholder="No end date"
              />
            </div>
          </div>

          {/* Ongoing checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="rp-ongoing"
              checked={ongoing}
              onCheckedChange={(v) => setOngoing(!!v)}
            />
            <Label htmlFor="rp-ongoing" className="font-normal cursor-pointer">Ongoing profile (no end date)</Label>
          </div>

          {/* Cash flow: Frequency + Amount */}
          {type === "cash_flow" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rp-frequency">Frequency</Label>
                  <Select value={frequency} onValueChange={(v) => setFrequency(v as ReturnProfileFrequency)}>
                    <SelectTrigger id="rp-frequency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rp-amount">Amount per period</Label>
                  <Input
                    id="rp-amount"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rp-currency">Currency</Label>
                  <Select value={currencyId} onValueChange={setCurrencyId}>
                    <SelectTrigger id="rp-currency" className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>({c.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DatePickerInput
                  id="rp-collection"
                  label="Collection day"
                  value={collectionDate}
                  onChange={setCollectionDate}
                />
              </div>
            </>
          )}

          {/* Compounding: Frequency + Growth recording day */}
          {type === "compounding" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rp-frequency">Frequency</Label>
                  <Select value={frequency} onValueChange={(v) => setFrequency(v as ReturnProfileFrequency)}>
                    <SelectTrigger id="rp-frequency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DatePickerInput
                  id="rp-recording"
                  label="Growth recording day"
                  value={growthRecordingDate}
                  onChange={setGrowthRecordingDate}
                />
              </div>

              {/* Rate + Method box */}
              <div className="rounded-md border p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="rp-rate">
                      Expected {frequency} growth rate (%) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="rp-rate"
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 1.00"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Used as the primary growth assumption for the selected frequency.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rp-method">Compounding method</Label>
                    <Select value={method} onValueChange={(v) => setMethod(v as ReturnProfileMethod)}>
                      <SelectTrigger id="rp-method" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">Simple</SelectItem>
                        <SelectItem value="compound">Compound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Override amount + Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rp-override">Optional growth override amount per period</Label>
                  <Input
                    id="rp-override"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Optional"
                    value={overrideAmount}
                    onChange={(e) => setOverrideAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Optional fixed override. Leave empty to model growth using the selected frequency rate.</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rp-currency" className="text-muted-foreground">Currency</Label>
                  <Select value={currencyId} onValueChange={setCurrencyId} disabled>
                    <SelectTrigger id="rp-currency" className="w-full opacity-60 cursor-not-allowed">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>({c.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Fixed to asset currency for compounding profiles.</p>
                </div>
              </div>
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={reset} disabled={saving}>Reset</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner className="mr-2 size-3.5" />}
              Create return profile
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
