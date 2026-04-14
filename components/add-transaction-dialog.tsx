"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
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

type TxType = { id: number; name: string }
type Asset = { id: string; name: string; currencyCode: string }

type EntryRow = {
  key: number
  entryType: string
  assetId: string
  direction: "in" | "out"
  amount: string
  units: string
  pricePerUnit: string
  source: string
  sourceId: string
}

const ENTRY_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "asset", label: "Asset" },
  { value: "equity", label: "Equity" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "fee", label: "Fee" },
  { value: "dividend", label: "Dividend" },
  { value: "interest", label: "Interest" },
  { value: "principal", label: "Principal" },
]

const SOURCE_TYPES = [
  { value: "", label: "None" },
  { value: "asset", label: "Asset" },
  { value: "cash", label: "Cash" },
  { value: "new_money_in", label: "New money in" },
  { value: "cap", label: "Cap table" },
  { value: "subscription", label: "Subscription" },
]

function emptyEntry(key: number): EntryRow {
  return { key, entryType: "cash", assetId: "", direction: "in", amount: "", units: "", pricePerUnit: "", source: "", sourceId: "" }
}

export function AddTransactionDialog({
  entityUUID,
  onSuccess,
  children,
}: {
  entityUUID: string
  onSuccess: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [txTypes, setTxTypes] = React.useState<TxType[]>([])
  const [assets, setAssets] = React.useState<Asset[]>([])

  const [typeId, setTypeId] = React.useState("")
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [reference, setReference] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [entries, setEntries] = React.useState<EntryRow[]>([emptyEntry(1), emptyEntry(2)])

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const nextKey = React.useRef(3)

  // Load types + assets on first open
  React.useEffect(() => {
    if (!open) return
    setTypeId("")
    setDate(new Date())
    setReference("")
    setNotes("")
    setEntries([emptyEntry(1), emptyEntry(2)])
    nextKey.current = 3
    setError(null)

    Promise.all([
      fetch("/api/transaction-types").then((r) => r.ok ? r.json() : []),
      fetch(`/api/assets?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []),
    ]).then(([types, assetList]) => {
      setTxTypes(
        (types as Array<{ id: number; name?: string }>)
          .filter((t) => t.name)
          .map((t) => ({ id: t.id, name: t.name! }))
      )
      setAssets(
        (assetList as Array<{ id: string; name?: string; _currency?: { code?: string } }>)
          .map((a) => ({ id: a.id, name: a.name ?? a.id.slice(0, 8), currencyCode: a._currency?.code ?? "" }))
      )
    })
  }, [open, entityUUID])

  function updateEntry(key: number, field: keyof EntryRow, value: string) {
    setEntries((prev) => prev.map((e) => e.key === key ? { ...e, [field]: value } : e))
  }

  function addEntry() {
    setEntries((prev) => [...prev, emptyEntry(nextKey.current++)])
  }

  function removeEntry(key: number) {
    setEntries((prev) => prev.filter((e) => e.key !== key))
  }

  async function handleSubmit() {
    const validEntries = entries.filter((e) => e.assetId && parseFloat(e.amount) > 0)
    if (validEntries.length === 0) { setError("Add at least one entry with an asset and amount."); return }
    if (!typeId) { setError("Select a transaction type."); return }

    setSaving(true)
    setError(null)
    try {
      // Create transaction
      const txRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          created_by_entity: entityUUID,
          type: Number(typeId),
          date: date ? date.getTime() : Date.now(),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      })
      if (!txRes.ok) throw new Error("Failed to create transaction")
      const tx = (await txRes.json()) as { id: string }

      // Create entries
      const asset = (id: string) => assets.find((a) => a.id === id)
      await Promise.all(
        validEntries.map((e) => {
          const a = asset(e.assetId)
          const body: Record<string, unknown> = {
            transaction: tx.id,
            entity: entityUUID,
            entry_type: e.entryType,
            object_type: "asset",
            object_id: e.assetId,
            direction: e.direction,
            amount: parseFloat(e.amount),
          }
          if (a?.currencyCode) {
            // Try to resolve currency id from assets list — not available here,
            // so we skip currency and let the backend default
          }
          if (e.units && parseFloat(e.units) > 0) body.units = parseFloat(e.units)
          if (e.pricePerUnit && parseFloat(e.pricePerUnit) > 0) body.price_per_unit = parseFloat(e.pricePerUnit)
          if (e.source) body.source = e.source
          if (e.sourceId) body.source_id = e.sourceId
          return fetch("/api/transaction-entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        })
      )

      onSuccess()
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create transaction")
    } finally {
      setSaving(false)
    }
  }

  const totalIn = entries.reduce((s, e) => s + (e.direction === "in" ? (parseFloat(e.amount) || 0) : 0), 0)
  const totalOut = entries.reduce((s, e) => s + (e.direction === "out" ? (parseFloat(e.amount) || 0) : 0), 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>
        {children}
      </div>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add transaction</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Transaction type</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  {txTypes.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DatePickerInput id="add-tx-date" label="Date" value={date} onChange={setDate} />
          </div>

          <div className="grid gap-2">
            <Label>Reference</Label>
            <Input placeholder="e.g. Subscription — Investor Name" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>

          {/* Entry rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Entries</Label>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addEntry}>
                <Plus className="size-3" />
                Add entry
              </Button>
            </div>

            <div className="rounded-lg border divide-y">
              {entries.map((entry, idx) => (
                <div key={entry.key} className="flex items-start gap-2 p-3">
                  <span className="text-xs text-muted-foreground mt-2 w-4 shrink-0">{idx + 1}</span>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="grid grid-cols-5 gap-2">
                      <Select value={entry.entryType} onValueChange={(v) => updateEntry(entry.key, "entryType", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ENTRY_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={entry.assetId} onValueChange={(v) => updateEntry(entry.key, "assetId", v)}>
                        <SelectTrigger className="h-8 text-xs col-span-2">
                          <SelectValue placeholder="Asset…" />
                        </SelectTrigger>
                        <SelectContent>
                          {assets.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}{a.currencyCode ? ` (${a.currencyCode})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={entry.direction} onValueChange={(v) => updateEntry(entry.key, "direction", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in">In</SelectItem>
                          <SelectItem value="out">Out</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount"
                        className="h-8 text-xs"
                        value={entry.amount}
                        onChange={(e) => updateEntry(entry.key, "amount", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={entry.source || "__none__"} onValueChange={(v) => updateEntry(entry.key, "source", v === "__none__" ? "" : v)}>
                        <SelectTrigger className="h-7 text-[11px] text-muted-foreground">
                          <SelectValue placeholder="Source…" />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCE_TYPES.map((s) => (
                            <SelectItem key={s.value || "__none__"} value={s.value || "__none__"}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {entry.source && entry.source !== "new_money_in" && (
                        <Select value={entry.sourceId || "__none__"} onValueChange={(v) => updateEntry(entry.key, "sourceId", v === "__none__" ? "" : v)}>
                          <SelectTrigger className="h-7 text-[11px] text-muted-foreground">
                            <SelectValue placeholder="Source asset…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {assets.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive mt-0"
                    onClick={() => removeEntry(entry.key)}
                    disabled={entries.length <= 1}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Balance summary */}
            <div className="flex items-center justify-end gap-4 text-xs tabular-nums">
              <span className="text-emerald-600">In: {totalIn.toFixed(2)}</span>
              <span className="text-red-500">Out: {totalOut.toFixed(2)}</span>
              {totalIn !== totalOut && totalIn > 0 && totalOut > 0 && (
                <span className="text-amber-600">Unbalanced: {Math.abs(totalIn - totalOut).toFixed(2)}</span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
            <textarea
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
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating…" : "Create transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
