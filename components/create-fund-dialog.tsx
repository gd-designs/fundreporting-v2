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

const FEE_TYPE_OPTIONS = [
  { value: "management", label: "Management" },
  { value: "performance", label: "Performance" },
  { value: "entry", label: "Entry" },
  { value: "exit", label: "Exit" },
  { value: "administration", label: "Administration" },
  { value: "setup", label: "Setup" },
  { value: "other", label: "Other" },
]

const FEE_BASIS_OPTIONS = [
  { value: "nav", label: "NAV" },
  { value: "committed_capital", label: "Committed Capital" },
  { value: "call_amount", label: "Call Amount" },
  { value: "profit", label: "Profit" },
  { value: "fixed", label: "Fixed Amount" },
]

const FEE_FREQ_OPTIONS = [
  { value: "one_time", label: "One Time" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
]

type FeeDraft = {
  type: string
  rate: string
  basis: string
  frequency: string
  hurdle_rate: string
  high_water_mark: boolean
  catch_up_rate: string
  fixed_amount: string
}

type ShareClassDraft = {
  name: string
  current_nav: string
  fees: FeeDraft[]
}

function emptyFee(): FeeDraft {
  return {
    type: "management",
    rate: "",
    basis: "nav",
    frequency: "annual",
    hurdle_rate: "",
    high_water_mark: false,
    catch_up_rate: "",
    fixed_amount: "",
  }
}

function emptyShareClass(): ShareClassDraft {
  return { name: "", current_nav: "", fees: [] }
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

// ── Fee row (inside a share class card) ────────────────────────────────────────

function FeeRow({
  fee,
  index,
  onUpdate,
  onRemove,
}: {
  fee: FeeDraft
  index: number
  onUpdate: (field: keyof FeeDraft, value: string | boolean) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded border bg-muted/30 p-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Fee {index + 1}</span>
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <X className="size-3" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Type</Label>
          <Select value={fee.type} onValueChange={(v) => onUpdate("type", v)}>
            <SelectTrigger className=" w-full h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FEE_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Frequency</Label>
          <Select value={fee.frequency} onValueChange={(v) => onUpdate("frequency", v)}>
            <SelectTrigger className=" w-full h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FEE_FREQ_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Basis</Label>
          <Select value={fee.basis} onValueChange={(v) => onUpdate("basis", v)}>
            <SelectTrigger className=" w-full h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FEE_BASIS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {fee.basis === "fixed" ? (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Fixed Amount</Label>
            <Input className="h-7 text-xs" type="number" min="0" step="0.01" placeholder="0.00" value={fee.fixed_amount} onChange={(e) => onUpdate("fixed_amount", e.target.value)} />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Rate (%)</Label>
            <Input className="h-7 text-xs" type="number" min="0" step="0.01" placeholder="e.g. 2.00" value={fee.rate} onChange={(e) => onUpdate("rate", e.target.value)} />
          </div>
        )}
      </div>
      {fee.type === "performance" && (
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Hurdle Rate (%)</Label>
            <Input className="h-7 text-xs" type="number" min="0" step="0.01" placeholder="e.g. 8.00" value={fee.hurdle_rate} onChange={(e) => onUpdate("hurdle_rate", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Catch-up Rate (%)</Label>
            <Input className="h-7 text-xs" type="number" min="0" step="0.01" placeholder="e.g. 100" value={fee.catch_up_rate} onChange={(e) => onUpdate("catch_up_rate", e.target.value)} />
          </div>
          <Label className="text-xs flex items-center gap-1.5 col-span-2">
            <input type="checkbox" checked={fee.high_water_mark} onChange={(e) => onUpdate("high_water_mark", e.target.checked)} className="size-3.5 rounded border" />
            High Water Mark
          </Label>
        </div>
      )}
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
  function addShareClass() {
    setShareClasses((prev) => [...prev, emptyShareClass()])
  }

  function removeShareClass(i: number) {
    setShareClasses((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateName(i: number, value: string) {
    setShareClasses((prev) => prev.map((sc, idx) => idx === i ? { ...sc, name: value } : sc))
  }

  function updateNav(i: number, value: string) {
    setShareClasses((prev) => prev.map((sc, idx) => idx === i ? { ...sc, current_nav: value } : sc))
  }

  function addFee(scIdx: number) {
    setShareClasses((prev) => prev.map((sc, idx) =>
      idx === scIdx ? { ...sc, fees: [...sc.fees, emptyFee()] } : sc
    ))
  }

  function removeFee(scIdx: number, feeIdx: number) {
    setShareClasses((prev) => prev.map((sc, idx) =>
      idx === scIdx ? { ...sc, fees: sc.fees.filter((_, fi) => fi !== feeIdx) } : sc
    ))
  }

  function updateFee(scIdx: number, feeIdx: number, field: keyof FeeDraft, value: string | boolean) {
    setShareClasses((prev) => prev.map((sc, idx) =>
      idx === scIdx
        ? { ...sc, fees: sc.fees.map((f, fi) => fi === feeIdx ? { ...f, [field]: value } : f) }
        : sc
    ))
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <p className="text-sm text-muted-foreground">
        Add one or more share classes with their fee rules. You can skip this and configure them later.
      </p>

      {shareClasses.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No share classes added yet.</p>
      ) : (
        <div className="flex flex-col gap-4 max-h-[52vh] overflow-y-auto pr-1">
          {shareClasses.map((sc, i) => (
            <div key={i} className="rounded-md border p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Share class {i + 1}
                </p>
                <button type="button" onClick={() => removeShareClass(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`sc-name-${i}`} className="text-xs">Name</Label>
                  <Input
                    id={`sc-name-${i}`}
                    placeholder="Class A"
                    value={sc.name}
                    onChange={(e) => updateName(i, e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`sc-nav-${i}`} className="text-xs">Starting NAV / share</Label>
                  <Input
                    id={`sc-nav-${i}`}
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="e.g. 100.00"
                    value={sc.current_nav}
                    onChange={(e) => updateNav(i, e.target.value)}
                  />
                </div>
              </div>

              {/* Fee rows */}
              {sc.fees.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Fees</p>
                  {sc.fees.map((fee, fi) => (
                    <FeeRow
                      key={fi}
                      fee={fee}
                      index={fi}
                      onUpdate={(field, value) => updateFee(i, fi, field, value)}
                      onRemove={() => removeFee(i, fi)}
                    />
                  ))}
                </div>
              )}

              <Button type="button" variant="ghost" size="sm" className="self-start h-7 text-xs" onClick={() => addFee(i)}>
                <Plus className="size-3" /> Add fee
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={addShareClass} className="self-start">
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

      // 2. Create share classes and their fees (fire-and-forget individual failures)
      await Promise.allSettled(
        shareClasses
          .filter((sc) => sc.name.trim())
          .map(async (sc) => {
            const scBody: Record<string, unknown> = { entity: fund.entity, name: sc.name.trim() }
            if (sc.current_nav) scBody.current_nav = parseFloat(sc.current_nav)
            const scRes = await fetch("/api/share-classes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(scBody),
            })
            if (!scRes.ok) return
            const scData = await scRes.json() as { id: string }

            // Create fees for this share class
            await Promise.allSettled(
              sc.fees.map((fee) => {
                const feeBody: Record<string, unknown> = {
                  share_class: scData.id,
                  entity: fund.entity,
                  type: fee.type || null,
                  basis: fee.basis || null,
                  frequency: fee.frequency || null,
                  rate: fee.basis !== "fixed" && fee.rate ? parseFloat(fee.rate) : null,
                  fixed_amount: fee.basis === "fixed" && fee.fixed_amount ? parseFloat(fee.fixed_amount) : null,
                  hurdle_rate: fee.hurdle_rate ? parseFloat(fee.hurdle_rate) : null,
                  high_water_mark: fee.type === "performance" ? fee.high_water_mark : null,
                  catch_up_rate: fee.catch_up_rate ? parseFloat(fee.catch_up_rate) : null,
                }
                return fetch("/api/share-class-fees", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(feeBody),
                })
              })
            )
          })
      )

      onCreated(fund)
      setOpen(false)
      reset()
    } catch {
      setError("Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  const STEP_LABELS = ["Fund details", "Share classes & fees"]

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
      <DialogContent className={step === 2 ? "max-w-lg" : "max-w-md"}>
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
