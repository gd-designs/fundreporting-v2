"use client"

import * as React from "react"
import { Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { DateTimePickerInput } from "@/components/date-time-input"
import { cn } from "@/lib/utils"

export type CreatedFund = {
  id: string
  entity: string
  name?: string | null
  fund_type?: string | null
  aum?: number | null
  inception_date?: number | null
  _currency?: { id: number; code: string; name: string } | null
}

export const FUND_TYPES = [
  { value: "alternative_investment", label: "Alternative Investment" },
  { value: "structured_product", label: "Structured Product" },
  { value: "regulated_fund", label: "Regulated Fund" },
]

type ShareClassDraft = {
  name: string
  management_fee: string
  carried_interest: string
  preferred_return: string
}

function emptyShareClass(): ShareClassDraft {
  return { name: "", management_fee: "", carried_interest: "", preferred_return: "" }
}

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <React.Fragment key={i}>
          <div
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
              i + 1 === current
                ? "bg-foreground text-background"
                : i + 1 < current
                  ? "bg-foreground/20 text-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={cn(
                "h-px flex-1 transition-colors",
                i + 1 < current ? "bg-foreground/30" : "bg-border",
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Step 1: Fund details ───────────────────────────────────────────────────────

function FundDetailsStep({
  name, setName,
  fundType, setFundType,
  currency, setCurrency,
  country, setCountry,
  inceptionDate, setInceptionDate,
  aum, setAum,
  currencies,
  countries,
  error,
  onCancel,
  onNext,
}: {
  name: string; setName: (v: string) => void
  fundType: string; setFundType: (v: string) => void
  currency: string; setCurrency: (v: string) => void
  country: string; setCountry: (v: string) => void
  inceptionDate: Date | null; setInceptionDate: (v: Date | null) => void
  aum: string; setAum: (v: string) => void
  currencies: { id: number; code: string; name: string }[]
  countries: { id: number; name: string; code?: string }[]
  error: string | null
  onCancel: () => void
  onNext: () => void
}) {
  const canProceed = name.trim() && fundType && currency && country && inceptionDate

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fund-name">Name</Label>
        <Input
          id="fund-name"
          placeholder="Acme Growth Fund I"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fund-type">Fund type</Label>
        <Select value={fundType} onValueChange={setFundType}>
          <SelectTrigger className="w-full" id="fund-type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {FUND_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fund-currency">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-full" id="fund-currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fund-country">Country</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-full" id="fund-country">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.code ? ` (${c.code})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DateTimePickerInput
        id="fund-inception"
        label="Inception date"
        value={inceptionDate ?? undefined}
        onChange={(d) => setInceptionDate(d ?? null)}
        showTime={false}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fund-aum">
          AUM <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="fund-aum"
          type="number"
          min="0"
          step="any"
          placeholder="0.00"
          value={aum}
          onChange={(e) => setAum(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" disabled={!canProceed} onClick={onNext}>
          Next: Share classes →
        </Button>
      </div>
    </div>
  )
}

// ── Step 2: Share classes ──────────────────────────────────────────────────────

function ShareClassesStep({
  shareClasses,
  setShareClasses,
  saving,
  error,
  onBack,
  onSubmit,
}: {
  shareClasses: ShareClassDraft[]
  setShareClasses: React.Dispatch<React.SetStateAction<ShareClassDraft[]>>
  saving: boolean
  error: string | null
  onBack: () => void
  onSubmit: () => void
}) {
  function addRow() {
    setShareClasses((prev) => [...prev, emptyShareClass()])
  }

  function removeRow(i: number) {
    setShareClasses((prev) => prev.filter((_, idx) => idx !== i))
  }

  function update(i: number, field: keyof ShareClassDraft, value: string) {
    setShareClasses((prev) =>
      prev.map((sc, idx) => (idx === i ? { ...sc, [field]: value } : sc)),
    )
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <p className="text-sm text-muted-foreground">
        Add one or more share classes for this fund. You can skip this and add them later.
      </p>

      {shareClasses.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No share classes added yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {shareClasses.map((sc, i) => (
            <div key={i} className="rounded-md border p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Share class {i + 1}
                </p>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`sc-name-${i}`}>Name</Label>
                <Input
                  id={`sc-name-${i}`}
                  placeholder="Class A"
                  value={sc.name}
                  onChange={(e) => update(i, "name", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`sc-mgmt-${i}`}>Mgmt fee %</Label>
                  <Input
                    id={`sc-mgmt-${i}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="2.0"
                    value={sc.management_fee}
                    onChange={(e) => update(i, "management_fee", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`sc-carry-${i}`}>Carry %</Label>
                  <Input
                    id={`sc-carry-${i}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="20.0"
                    value={sc.carried_interest}
                    onChange={(e) => update(i, "carried_interest", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`sc-hurdle-${i}`}>Hurdle %</Label>
                  <Input
                    id={`sc-hurdle-${i}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="8.0"
                    value={sc.preferred_return}
                    onChange={(e) => update(i, "preferred_return", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        className="self-start"
      >
        <Plus className="size-3.5" />
        Add share class
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between gap-2 pt-1 border-t">
        <Button type="button" variant="ghost" onClick={onBack} disabled={saving}>
          ← Back
        </Button>
        <Button type="button" onClick={onSubmit} disabled={saving}>
          {saving ? (
            <><Loader2 className="size-4 animate-spin" /> Creating…</>
          ) : (
            "Create fund"
          )}
        </Button>
      </div>
    </div>
  )
}

// ── Main dialog ────────────────────────────────────────────────────────────────

export function CreateFundDialog({
  assetManagerId,
  onCreated,
  trigger,
  defaultCurrency,
  defaultCountry,
}: {
  assetManagerId: string
  onCreated: (fund: CreatedFund) => void
  trigger?: React.ReactNode
  defaultCurrency?: number | null
  defaultCountry?: number | null
}) {
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<1 | 2>(1)

  // Step 1 fields
  const [name, setName] = React.useState("")
  const [fundType, setFundType] = React.useState("")
  const [currency, setCurrency] = React.useState(defaultCurrency ? String(defaultCurrency) : "")
  const [country, setCountry] = React.useState(defaultCountry ? String(defaultCountry) : "")
  const [inceptionDate, setInceptionDate] = React.useState<Date | null>(null)
  const [aum, setAum] = React.useState("")

  // Step 2 fields
  const [shareClasses, setShareClasses] = React.useState<ShareClassDraft[]>([])

  // Shared
  const [currencies, setCurrencies] = React.useState<{ id: number; code: string; name: string }[]>([])
  const [countries, setCountries] = React.useState<{ id: number; name: string; code?: string }[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    fetch("/api/currencies")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCurrencies(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch("/api/countries")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCountries(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [open])

  function reset() {
    setStep(1)
    setName("")
    setFundType("")
    setCurrency(defaultCurrency ? String(defaultCurrency) : "")
    setCountry(defaultCountry ? String(defaultCountry) : "")
    setInceptionDate(null)
    setAum("")
    setShareClasses([])
    setError(null)
  }

  async function handleSubmit() {
    setError(null)
    setSaving(true)
    try {
      // 1. Create the fund
      const body: Record<string, unknown> = {
        name: name.trim(),
        managed_by: assetManagerId,
        fund_type: fundType,
        currency: Number(currency),
        country: Number(country),
        inception_date: inceptionDate!.getTime(),
      }
      if (aum) body.aum = parseFloat(aum)

      const fundRes = await fetch("/api/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const fundData = await fundRes.json()
      if (!fundRes.ok) {
        setError(fundData.error ?? "Failed to create fund.")
        return
      }
      const fund = fundData as CreatedFund

      // 2. Create share classes (fire-and-forget individual failures)
      const scPromises = shareClasses
        .filter((sc) => sc.name.trim())
        .map((sc) => {
          const scBody: Record<string, unknown> = { entity: fund.entity, name: sc.name.trim() }
          if (sc.management_fee) scBody.management_fee = parseFloat(sc.management_fee)
          if (sc.carried_interest) scBody.carried_interest = parseFloat(sc.carried_interest)
          if (sc.preferred_return) scBody.preferred_return = parseFloat(sc.preferred_return)
          return fetch("/api/share-classes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(scBody),
          })
        })
      await Promise.allSettled(scPromises)

      onCreated(fund)
      setOpen(false)
      reset()
    } catch {
      setError("Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  const STEP_LABELS = ["Fund details", "Share classes"]

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Create fund
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create fund</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1 mt-1">
          <StepIndicator current={step} total={2} />
          <p className="text-xs text-muted-foreground">
            Step {step} of 2 — {STEP_LABELS[step - 1]}
          </p>
        </div>

        {step === 1 ? (
          <FundDetailsStep
            name={name} setName={setName}
            fundType={fundType} setFundType={setFundType}
            currency={currency} setCurrency={setCurrency}
            country={country} setCountry={setCountry}
            inceptionDate={inceptionDate} setInceptionDate={setInceptionDate}
            aum={aum} setAum={setAum}
            currencies={currencies}
            countries={countries}
            error={error}
            onCancel={() => { setOpen(false); reset() }}
            onNext={() => { setError(null); setStep(2) }}
          />
        ) : (
          <ShareClassesStep
            shareClasses={shareClasses}
            setShareClasses={setShareClasses}
            saving={saving}
            error={error}
            onBack={() => { setError(null); setStep(1) }}
            onSubmit={handleSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
