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
import { Spinner } from "@/components/ui/spinner"
import { type EntityTransaction, type TransactionLeg } from "@/lib/entity-transactions"

type Asset = { id: string; name: string; currencyCode: string }

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

type NewEntry = {
  key: number
  entryType: string
  assetId: string
  direction: "in" | "out"
  amount: string
  source: string
  sourceId: string
}

function emptyEntry(key: number): NewEntry {
  return { key, entryType: "cash", assetId: "", direction: "in", amount: "", source: "", sourceId: "" }
}

export function EditTransactionDialog({
  open,
  onClose,
  transaction,
  entityUUID,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  transaction: EntityTransaction | null
  entityUUID: string
  onSaved: () => void
}) {
  const [typeId, setTypeId] = React.useState("")
  const [txTypes, setTxTypes] = React.useState<Array<{ id: number; name: string }>>([])
  const [reference, setReference] = React.useState("")
  const [date, setDate] = React.useState<Date | undefined>()
  const [notes, setNotes] = React.useState("")
  const [assets, setAssets] = React.useState<Asset[]>([])
  const [newEntries, setNewEntries] = React.useState<NewEntry[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingLegId, setDeletingLegId] = React.useState<string | null>(null)
  // Local edits to existing legs — keyed by leg.id. Only changed fields are PATCHed.
  type LegEdit = {
    entryType: string
    assetId: string
    direction: "in" | "out"
    amount: string
    source: string
    sourceId: string
  }
  const [legEdits, setLegEdits] = React.useState<Record<string, LegEdit>>({})
  const nextKey = React.useRef(1)

  function legCurrent(leg: TransactionLeg): LegEdit {
    return legEdits[leg.id] ?? {
      entryType: leg.entryType,
      assetId: leg.assetId,
      direction: leg.direction,
      amount: String(leg.amount),
      source: leg.source ?? "",
      sourceId: leg.sourceId ?? "",
    }
  }
  function updateLeg(legId: string, field: keyof LegEdit, value: string) {
    setLegEdits((prev) => {
      const base = prev[legId] ?? legCurrent(transaction!.legs.find((l) => l.id === legId)!)
      return { ...prev, [legId]: { ...base, [field]: value } }
    })
  }
  function diffPatch(leg: TransactionLeg): Record<string, unknown> | null {
    const e = legEdits[leg.id]
    if (!e) return null
    const patch: Record<string, unknown> = {}
    if (e.entryType !== leg.entryType) patch.entry_type = e.entryType
    if (e.assetId !== leg.assetId) patch.object_id = e.assetId
    if (e.direction !== leg.direction) patch.direction = e.direction
    const amt = parseFloat(e.amount)
    if (Number.isFinite(amt) && amt !== leg.amount) patch.amount = amt
    if ((e.source || null) !== leg.source) patch.source = e.source || null
    if ((e.sourceId || null) !== leg.sourceId) patch.source_id = e.sourceId || null
    return Object.keys(patch).length > 0 ? patch : null
  }

  React.useEffect(() => {
    if (open && transaction) {
      setTypeId(transaction.typeId ? String(transaction.typeId) : "")
      setReference(transaction.reference ?? "")
      setDate(transaction.date ? new Date(transaction.date) : new Date())
      setNotes(transaction.notes ?? "")
      setNewEntries([])
      setLegEdits({})
      nextKey.current = 1
      setError(null)
      // Load assets + transaction types for dropdowns
      Promise.all([
        fetch(`/api/assets?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []),
        fetch("/api/transaction-types").then((r) => r.ok ? r.json() : []),
      ]).then(([assetList, types]) => {
        setAssets(
          (assetList as Array<{ id: string; name?: string; _currency?: { code?: string } }>)
            .map((a) => ({ id: a.id, name: a.name ?? a.id.slice(0, 8), currencyCode: a._currency?.code ?? "" }))
        )
        setTxTypes(
          (types as Array<{ id: number; name?: string }>)
            .filter((t) => t.name)
            .map((t) => ({ id: t.id, name: t.name! }))
        )
      }).catch(() => {})
    }
  }, [open, transaction?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!transaction) return
    setSaving(true)
    setError(null)
    try {
      // 1. PATCH transaction header
      await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(typeId ? { type: Number(typeId) } : {}),
          reference: reference.trim() || null,
          date: date ? date.getTime() : transaction.date,
          notes: notes.trim() || null,
        }),
      })

      // 2. PATCH any existing legs that the user edited
      await Promise.all(
        transaction.legs
          .map((leg) => ({ leg, patch: diffPatch(leg) }))
          .filter(({ patch }) => patch != null)
          .map(({ leg, patch }) =>
            fetch(`/api/transaction-entries/${leg.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(patch),
            }),
          ),
      )

      // 3. Create new entries
      const validNew = newEntries.filter((e) => e.assetId && parseFloat(e.amount) > 0)
      await Promise.all(
        validNew.map((e) => {
          const body: Record<string, unknown> = {
            transaction: transaction.id,
            entity: entityUUID,
            entry_type: e.entryType,
            object_type: "asset",
            object_id: e.assetId,
            direction: e.direction,
            amount: parseFloat(e.amount),
          }
          if (e.source) body.source = e.source
          if (e.sourceId) body.source_id = e.sourceId
          return fetch("/api/transaction-entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        })
      )

      onSaved()
      onClose()
    } catch {
      setError("Failed to save transaction.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteLeg(legId: string) {
    setDeletingLegId(legId)
    try {
      await fetch(`/api/transaction-entries/${legId}`, { method: "DELETE" })
      onSaved() // reload to refresh legs
    } finally {
      setDeletingLegId(null)
    }
  }

  function updateNewEntry(key: number, field: keyof NewEntry, value: string) {
    setNewEntries((prev) => prev.map((e) => e.key === key ? { ...e, [field]: value } : e))
  }

  function addNewEntry() {
    setNewEntries((prev) => [...prev, emptyEntry(nextKey.current++)])
  }

  if (!transaction) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  {txTypes.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DatePickerInput id="edit-tx-date" label="Date" value={date} onChange={setDate} />
          </div>

          <div className="grid gap-2">
            <Label>Reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Subscription — Investor" />
          </div>

          <div className="grid gap-2">
            <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes…"
              className="border-input bg-background min-h-16 rounded-md border px-3 py-2 text-sm"
            />
          </div>

          {/* Existing entries — editable */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Existing entries</Label>
            <div className="rounded-lg border divide-y">
              {transaction.legs.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">No entries</div>
              )}
              {transaction.legs.map((leg, idx) => {
                const cur = legCurrent(leg)
                return (
                  <div key={leg.id} className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground mt-2 w-4 shrink-0">{idx + 1}</span>
                      <div className="grid grid-cols-5 gap-2 flex-1">
                        <Select value={cur.entryType} onValueChange={(v) => updateLeg(leg.id, "entryType", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ENTRY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <Select value={cur.assetId} onValueChange={(v) => updateLeg(leg.id, "assetId", v)}>
                          <SelectTrigger className="h-8 text-xs col-span-2"><SelectValue placeholder="Asset…" /></SelectTrigger>
                          <SelectContent>
                            {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.currencyCode ? ` (${a.currencyCode})` : ""}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <Select value={cur.direction} onValueChange={(v) => updateLeg(leg.id, "direction", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in">In</SelectItem>
                            <SelectItem value="out">Out</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input
                          type="number" min="0" step="0.01" placeholder="Amount" className="h-8 text-xs"
                          value={cur.amount}
                          onChange={(e) => updateLeg(leg.id, "amount", e.target.value)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={deletingLegId === leg.id}
                        onClick={() => deleteLeg(leg.id)}
                      >
                        {deletingLegId === leg.id ? <Spinner className="size-3" /> : <Trash2 className="size-3" />}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 ml-6">
                      <Select value={cur.source || "__none__"} onValueChange={(v) => updateLeg(leg.id, "source", v === "__none__" ? "" : v)}>
                        <SelectTrigger className="h-7 text-[11px] text-muted-foreground"><SelectValue placeholder="Source…" /></SelectTrigger>
                        <SelectContent>
                          {SOURCE_TYPES.map((s) => <SelectItem key={s.value || "__none__"} value={s.value || "__none__"}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {cur.source && cur.source !== "new_money_in" && (
                        <Select value={cur.sourceId || "__none__"} onValueChange={(v) => updateLeg(leg.id, "sourceId", v === "__none__" ? "" : v)}>
                          <SelectTrigger className="h-7 text-[11px] text-muted-foreground"><SelectValue placeholder="Source asset…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* New entries */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Add entries</Label>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addNewEntry}>
                <Plus className="size-3" />
                Add entry
              </Button>
            </div>

            {newEntries.length > 0 && (
              <div className="rounded-lg border divide-y">
                {newEntries.map((entry, idx) => (
                  <div key={entry.key} className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground mt-2 w-4 shrink-0">+{idx + 1}</span>
                      <div className="grid grid-cols-5 gap-2 flex-1">
                        <Select value={entry.entryType} onValueChange={(v) => updateNewEntry(entry.key, "entryType", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ENTRY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <Select value={entry.assetId} onValueChange={(v) => updateNewEntry(entry.key, "assetId", v)}>
                          <SelectTrigger className="h-8 text-xs col-span-2"><SelectValue placeholder="Asset…" /></SelectTrigger>
                          <SelectContent>
                            {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.currencyCode ? ` (${a.currencyCode})` : ""}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <Select value={entry.direction} onValueChange={(v) => updateNewEntry(entry.key, "direction", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in">In</SelectItem>
                            <SelectItem value="out">Out</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input type="number" min="0" step="0.01" placeholder="Amount" className="h-8 text-xs" value={entry.amount} onChange={(e) => updateNewEntry(entry.key, "amount", e.target.value)} />
                      </div>
                      <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setNewEntries((prev) => prev.filter((e) => e.key !== entry.key))}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 ml-6">
                      <Select value={entry.source || "__none__"} onValueChange={(v) => updateNewEntry(entry.key, "source", v === "__none__" ? "" : v)}>
                        <SelectTrigger className="h-7 text-[11px] text-muted-foreground"><SelectValue placeholder="Source…" /></SelectTrigger>
                        <SelectContent>
                          {SOURCE_TYPES.map((s) => <SelectItem key={s.value || "__none__"} value={s.value || "__none__"}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {entry.source && entry.source !== "new_money_in" && (
                        <Select value={entry.sourceId || "__none__"} onValueChange={(v) => updateNewEntry(entry.key, "sourceId", v === "__none__" ? "" : v)}>
                          <SelectTrigger className="h-7 text-[11px] text-muted-foreground"><SelectValue placeholder="Source asset…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="size-4 mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
