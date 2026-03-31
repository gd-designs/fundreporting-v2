"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePickerInput } from "@/components/date-input"

export type PnlCategory =
  | "gross_revenue"
  | "cogs"
  | "operating_expense"
  | "interest_income"
  | "interest_expense"

export type PnlItem = {
  id: string
  entity: string
  label: string
  amount: number
  category: PnlCategory
  date?: number | null
  notes?: string | null
}

export const PNL_CATEGORY_LABELS: Record<PnlCategory, string> = {
  gross_revenue: "Gross Revenue",
  cogs: "Cost of Income (COGS)",
  operating_expense: "Operating Expense",
  interest_income: "Interest Income",
  interest_expense: "Interest Expense",
}

const CATEGORY_OPTIONS: { value: PnlCategory; label: string; description: string }[] = [
  { value: "gross_revenue", label: "Gross Revenue", description: "Other income not from assets" },
  { value: "cogs", label: "Cost of Income (COGS)", description: "Direct costs linked to income" },
  { value: "operating_expense", label: "Operating Expense", description: "Fund running costs, salaries, etc." },
  { value: "interest_income", label: "Interest Income", description: "Interest earned on loans given out" },
  { value: "interest_expense", label: "Interest Expense", description: "Interest paid on borrowings" },
]

export function AddPnlItemDialog({
  open,
  onClose,
  entityId,
  defaultCategory,
  existingItem,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  entityId: string
  defaultCategory?: PnlCategory
  existingItem?: PnlItem | null
  onSaved: () => void
}) {
  const isEdit = !!existingItem
  const [label, setLabel] = React.useState(existingItem?.label ?? "")
  const [amount, setAmount] = React.useState(existingItem ? String(existingItem.amount) : "")
  const [category, setCategory] = React.useState<PnlCategory>(existingItem?.category ?? defaultCategory ?? "gross_revenue")
  const [date, setDate] = React.useState<Date | undefined>(
    existingItem?.date ? new Date(existingItem.date) : undefined
  )
  const [notes, setNotes] = React.useState(existingItem?.notes ?? "")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setLabel(existingItem?.label ?? "")
      setAmount(existingItem ? String(existingItem.amount) : "")
      setCategory(existingItem?.category ?? defaultCategory ?? "gross_revenue")
      setDate(existingItem?.date ? new Date(existingItem.date) : undefined)
      setNotes(existingItem?.notes ?? "")
      setError(null)
    }
  }, [open, existingItem, defaultCategory])

  async function handleSave() {
    if (!label.trim() || !amount) { setError("Label and amount are required."); return }
    const amountNum = Number(amount)
    if (isNaN(amountNum) || amountNum <= 0) { setError("Amount must be a positive number."); return }
    setSaving(true)
    setError(null)
    try {
      const body = {
        entity: entityId,
        label: label.trim(),
        amount: amountNum,
        category,
        date: date ? date.getTime() : null,
        notes: notes.trim() || null,
      }
      const url = isEdit ? `/api/pnl-items/${existingItem!.id}` : "/api/pnl-items"
      const method = isEdit ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed to save item.")
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit P&L item" : "Add P&L item"}</DialogTitle>
        </DialogHeader>
        <FieldGroup className="py-1">
          <Field>
            <FieldLabel>Category</FieldLabel>
            <Select value={category} onValueChange={(v) => setCategory(v as PnlCategory)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label} — {o.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Label</FieldLabel>
            <Input
              placeholder="e.g. Rental income — 12 Oak Street"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Amount</FieldLabel>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <DatePickerInput
            id="pnl-item-date"
            label="Date (optional)"
            value={date}
            onChange={setDate}
          />
          <Field>
            <FieldLabel>Notes (optional)</FieldLabel>
            <Textarea
              placeholder="Optional context…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </Field>
          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
