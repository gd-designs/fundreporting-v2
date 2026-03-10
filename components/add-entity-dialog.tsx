"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { notifyEntitiesUpdate } from "@/lib/ledger-events"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { DatePickerInput } from "@/components/date-input"
import type { EntityType } from "@/lib/types"

type Currency = { id: number; code: string; name: string }
type Country = { id: number; name: string }

const TYPE_SLUGS: Record<EntityType, string> = {
  portfolio: "portfolio",
  company: "company",
  fund: "fund",
  family_office: "family-office",
  asset_manager: "asset-manager",
}

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: "portfolio", label: "Portfolio" },
  { value: "company", label: "Company" },
  { value: "family_office", label: "Family Office" },
  { value: "asset_manager", label: "Asset Manager" },
]

function CountryField({ countries, value, onChange }: { countries: Country[]; value: string; onChange: (v: string) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor="country">Country</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="country" className="w-full">
          <SelectValue placeholder="Select country…" />
        </SelectTrigger>
        <SelectContent>
          {countries.map(c => (
            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function CurrencyField({ currencies, value, onChange }: { currencies: Currency[]; value: string; onChange: (v: string) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor="currency">Currency</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="currency" className="w-full">
          <SelectValue placeholder="Select currency…" />
        </SelectTrigger>
        <SelectContent>
          {currencies.map(c => (
            <SelectItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function AddEntityDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [type, setType] = React.useState<EntityType | "">("")
  const [forcedPortfolio, setForcedPortfolio] = React.useState(false)
  const [name, setName] = React.useState("")
  const [fields, setFields] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [currencies, setCurrencies] = React.useState<Currency[]>([])
  const [countries, setCountries] = React.useState<Country[]>([])

  React.useEffect(() => {
    if (!open) return
    Promise.all([
      fetch("/api/entities").then(r => r.ok ? r.json() : []),
      fetch("/api/currencies").then(r => r.ok ? r.json() : []),
      fetch("/api/countries").then(r => r.ok ? r.json() : []),
    ]).then(([entities, cur, cou]) => {
      const noEntities = Array.isArray(entities) && entities.length === 0
      setForcedPortfolio(noEntities)
      setType(noEntities ? "portfolio" : "")
      setCurrencies(cur)
      setCountries(cou)
    }).catch(() => {})
  }, [open])

  function reset() {
    setType("")
    setForcedPortfolio(false)
    setName("")
    setFields({})
    setError(null)
  }

  function setField(key: string, value: string) {
    setFields(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!type || !name.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch("/api/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, name: name.trim(), ...fields }),
    })

    setLoading(false)

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? "Failed to create entity.")
      return
    }

    reset()
    setOpen(false)
    notifyEntitiesUpdate()
    router.refresh()
    router.push(`/${TYPE_SLUGS[type]}/${data.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={open => { setOpen(open); if (!open) reset() }}>
      <span onClick={() => setOpen(true)}>{children}</span>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Entity</DialogTitle>
            <DialogDescription>
              Add a portfolio, company, or other entity to your workspace.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="entity-type">Entity type</FieldLabel>
              <Select value={type} onValueChange={v => { setType(v as EntityType); setFields({}) }} disabled={forcedPortfolio}>
                <SelectTrigger id="entity-type" className="w-full">
                  <SelectValue placeholder="Select a type…" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="entity-name">Name</FieldLabel>
              <Input
                id="entity-name"
                placeholder="e.g. GDC Investments"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </Field>

            {type && (
              <CurrencyField currencies={currencies} value={fields.currency ?? ""} onChange={v => setField("currency", v)} />
            )}

            {type === "portfolio" && (
              <DatePickerInput
                id="inception-date"
                label="Inception date"
                value={fields.inception_date ? new Date(fields.inception_date) : undefined}
                onChange={d => setField("inception_date", d ? d.toISOString() : "")}
                placeholder="January 01, 2025"
              />
            )}

            {type === "company" && (
              <>
                <CountryField countries={countries} value={fields.country ?? ""} onChange={v => setField("country", v)} />
                <Field>
                  <FieldLabel htmlFor="industry">Industry</FieldLabel>
                  <Input id="industry" placeholder="Technology" value={fields.industry ?? ""} onChange={e => setField("industry", e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="reg-number">Registration number</FieldLabel>
                  <Input id="reg-number" placeholder="12345678" value={fields.registration_number ?? ""} onChange={e => setField("registration_number", e.target.value)} />
                </Field>
              </>
            )}

            {(type === "family_office" || type === "asset_manager") && (
              <CountryField countries={countries} value={fields.country ?? ""} onChange={v => setField("country", v)} />
            )}

            {type === "fund" && (
              <Field>
                <FieldLabel htmlFor="aum">AUM</FieldLabel>
                <Input id="aum" type="number" placeholder="0" value={fields.aum ?? ""} onChange={e => setField("aum", e.target.value)} />
              </Field>
            )}

            {type === "fund" && (
              <>
                <Field>
                  <FieldLabel htmlFor="fund-type">Fund type</FieldLabel>
                  <Input id="fund-type" placeholder="e.g. Hedge Fund" value={fields.fund_type ?? ""} onChange={e => setField("fund_type", e.target.value)} />
                </Field>
                <DatePickerInput
                  id="inception-date"
                  label="Inception date"
                  value={fields.inception_date ? new Date(fields.inception_date) : undefined}
                  onChange={d => setField("inception_date", d ? d.toISOString() : "")}
                  placeholder="January 01, 2025"
                />
              </>
            )}

            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !type || !name.trim()}>
              {loading && <Spinner className="mr-1" />}
              Create entity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
