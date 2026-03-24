"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldLabel } from "@/components/ui/field"

// ─── Types ───────────────────────────────────────────────────────────────────

export type FeeRow = {
  _key: string
  type: string
  rate: string
  rateIsAnnual: boolean
  basis: string
  frequency: string
  fixedAmount: string
  hurdleRate: string
  highWaterMark: boolean
  catchUpRate: string
}

export function emptyFee(): FeeRow {
  return {
    _key: crypto.randomUUID(),
    type: "",
    rate: "",
    rateIsAnnual: true,
    basis: "nav",
    frequency: "annual",
    fixedAmount: "",
    hurdleRate: "",
    highWaterMark: false,
    catchUpRate: "",
  }
}

export const FEE_TYPE_LABELS: Record<string, string> = {
  management: "Management",
  performance: "Performance",
  entry: "Entry",
  exit: "Exit",
  administration: "Administration",
  setup: "Setup",
  other: "Other",
}

export const BASIS_LABELS: Record<string, string> = {
  nav: "NAV",
  committed_capital: "Committed capital",
  call_amount: "Call amount",
  profit: "Profit",
  fixed: "Fixed amount",
}

export const FREQ_LABELS: Record<string, string> = {
  one_time: "One-time",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  annual: "Annual",
}

// ─── Fee form ────────────────────────────────────────────────────────────────

export function FeeForm({
  value,
  onChange,
  onAdd,
  addLabel = "Add fee",
}: {
  value: FeeRow
  onChange: (updated: FeeRow) => void
  onAdd: (fee: FeeRow) => void
  addLabel?: string
}) {
  const isPerf = value.type === "performance"
  const isFixed = value.basis === "fixed"

  function set<K extends keyof FeeRow>(k: K, v: FeeRow[K]) {
    onChange({ ...value, [k]: v })
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel>Type</FieldLabel>
          <Select value={value.type} onValueChange={(v) => set("type", v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {Object.entries(FEE_TYPE_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Basis</FieldLabel>
          <Select value={value.basis} onValueChange={(v) => set("basis", v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {Object.entries(BASIS_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {isFixed ? (
        <Field>
          <FieldLabel>Fixed amount</FieldLabel>
          <Input type="number" min="0" step="0.01" placeholder="e.g. 5000" value={value.fixedAmount} onChange={(e) => set("fixedAmount", e.target.value)} />
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>Rate (%)</FieldLabel>
            <Input type="number" min="0" step="0.01" placeholder="e.g. 2.00" value={value.rate} onChange={(e) => set("rate", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Frequency</FieldLabel>
            <Select value={value.frequency} onValueChange={(v) => set("frequency", v)}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {Object.entries(FREQ_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      <div className="flex items-center gap-4">
        {!isFixed && (
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={value.rateIsAnnual} onCheckedChange={(v) => set("rateIsAnnual", v === true)} />
            Annual rate
          </label>
        )}
        {isPerf && (
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={value.highWaterMark} onCheckedChange={(v) => set("highWaterMark", v === true)} />
            High water mark
          </label>
        )}
      </div>

      {isPerf && (
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>Hurdle rate (%)</FieldLabel>
            <Input type="number" min="0" step="0.01" placeholder="e.g. 8.00" value={value.hurdleRate} onChange={(e) => set("hurdleRate", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Catch-up rate (%)</FieldLabel>
            <Input type="number" min="0" step="0.01" placeholder="e.g. 100" value={value.catchUpRate} onChange={(e) => set("catchUpRate", e.target.value)} />
          </Field>
        </div>
      )}

      <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => onAdd(value)} disabled={!value.type}>
        <Plus className="size-3.5 mr-1.5" />
        {addLabel}
      </Button>
    </div>
  )
}
