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
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { DatePickerInput } from "@/components/date-input"
import { Spinner } from "@/components/ui/spinner"
import type { CapTableEntry, CapTableShareholder, ShareClass } from "@/lib/cap-table"

function fmtCcy(n: number, code: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(n)
  } catch {
    return String(n)
  }
}

function fmt(n: number, digits = 4) {
  return new Intl.NumberFormat("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
}

export type RecipientOption = {
  entryId: string
  name: string
  email?: string | null
}

export function ShareTransferDeclareDialog({
  open,
  onClose,
  sellerShareholder,
  sellerEntry,
  sellerAvailableShares,
  recipients,
  fundEntityUUID,
  shareClasses,
  currencyCode,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  sellerShareholder: CapTableShareholder
  sellerEntry: CapTableEntry
  sellerAvailableShares: number
  recipients: RecipientOption[]
  fundEntityUUID: string
  shareClasses: ShareClass[]
  currencyCode: string
  onSuccess: () => void
}) {
  const scMap = React.useMemo(() => new Map(shareClasses.map((sc) => [sc.id, sc])), [shareClasses])
  const nav = sellerEntry.share_class ? scMap.get(sellerEntry.share_class)?.current_nav ?? 0 : 0

  const [recipientId, setRecipientId] = React.useState("")
  const [sharesToTransfer, setSharesToTransfer] = React.useState(String(sellerAvailableShares))
  const [transferAmount, setTransferAmount] = React.useState(nav > 0 ? (sellerAvailableShares * nav).toFixed(2) : "")
  // Once the user manually edits the amount, stop auto-syncing it from shares.
  // This is what allows discounts/premiums (price ≠ shares × NAV).
  const [amountTouched, setAmountTouched] = React.useState(false)
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setRecipientId("")
      setSharesToTransfer(String(sellerAvailableShares))
      setTransferAmount(nav > 0 ? (sellerAvailableShares * nav).toFixed(2) : "")
      setAmountTouched(false)
      setDate(new Date())
      setError(null)
    }
  }, [open, sellerAvailableShares, nav])

  const shares = sharesToTransfer ? Number(sharesToTransfer) : 0
  const amount = transferAmount ? Number(transferAmount) : 0
  const impliedNav = shares > 0 ? amount / shares : 0
  // Use an epsilon to avoid floating-point red on visually-equal prices.
  const navDiff = impliedNav - nav
  const navDiffNoticeable = nav > 0 && Math.abs(navDiff) >= 0.01

  async function handleDeclare() {
    if (!recipientId) { setError("Select a recipient."); return }
    if (!shares || shares <= 0) { setError("Enter shares to transfer."); return }
    if (shares > sellerAvailableShares) { setError("Cannot transfer more shares than held."); return }
    if (!amount || amount <= 0) { setError("Enter a transfer amount."); return }
    setSaving(true); setError(null)
    try {
      const transferTs = date?.getTime() ?? Date.now()
      const isImmediate = transferTs <= Date.now()
      const res = await fetch("/api/share-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: fundEntityUUID,
          seller_cap_table_entry: sellerEntry.id,
          buyer_cap_table_entry: recipientId,
          shares,
          amount,
          nav_per_share: impliedNav,
          transferred_at: transferTs,
          status: "pending",
          notes: `${sellerShareholder.name ?? "Seller"} → ${recipients.find((r) => r.entryId === recipientId)?.name ?? "buyer"}`,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to record share transfer" }))
        setError(err.error ?? "Failed to record share transfer")
        return
      }
      // If the transfer date is today or earlier, execute immediately.
      // Otherwise it stays pending until the scheduled task fires.
      if (isImmediate) {
        const created = (await res.json()) as { id?: string }
        if (created.id) {
          const execRes = await fetch("/api/fund-share-transfer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shareTransferId: created.id }),
          })
          if (!execRes.ok) {
            const err = await execRes.json().catch(() => ({ error: "Recorded but failed to execute" }))
            setError(err.error ?? "Recorded but failed to execute")
            return
          }
        }
      }
      onSuccess()
      onClose()
    } catch {
      setError("Failed to record share transfer.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Declare share transfer</DialogTitle>
          <p className="text-sm text-muted-foreground">
            From <span className="font-medium">{sellerShareholder.name ?? "—"}</span>. Recorded as pending — executed when the next period is closed.
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <div className="rounded-lg border p-3 bg-muted/30 text-sm flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available shares</span>
              <span className="font-medium">{fmt(sellerAvailableShares, 4)}</span>
            </div>
            {nav > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current NAV / share</span>
                <span className="font-medium">{fmtCcy(nav, currencyCode)}</span>
              </div>
            )}
          </div>
          <Field>
            <FieldLabel htmlFor="st-recipient">Transfer to</FieldLabel>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger id="st-recipient" className="w-full">
                <SelectValue placeholder="Select investor…" />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((r) => (
                  <SelectItem key={r.entryId} value={r.entryId}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="st-shares">Shares to transfer</FieldLabel>
              <Input
                id="st-shares" type="number" min="0" max={sellerAvailableShares} step="0.0001"
                value={sharesToTransfer}
                onChange={(e) => {
                  const raw = e.target.value
                  setSharesToTransfer(raw)
                  // Only auto-sync amount if the user hasn't manually overridden it.
                  if (amountTouched) return
                  const s = Number(raw)
                  setTransferAmount(raw === "" || !Number.isFinite(s) || s <= 0 || nav <= 0 ? "" : (s * nav).toFixed(2))
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="st-amount">Transfer amount ({currencyCode})</FieldLabel>
              <Input
                id="st-amount" type="number" min="0" step="0.01"
                value={transferAmount}
                onChange={(e) => {
                  // User editing amount → free-form. Stop syncing from shares.
                  setTransferAmount(e.target.value)
                  setAmountTouched(true)
                }}
              />
              {amountTouched && (
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 self-end"
                  onClick={() => {
                    setAmountTouched(false)
                    setTransferAmount(nav > 0 && shares > 0 ? (shares * nav).toFixed(2) : "")
                  }}
                >
                  Reset to NAV
                </button>
              )}
            </Field>
          </div>
          {shares > 0 && nav > 0 && (
            <div className="rounded-lg border p-3 bg-muted/30 text-sm flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Implied price / share</span>
                <span className="font-medium tabular-nums">{fmtCcy(impliedNav, currencyCode)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">vs. current NAV / share</span>
                <span className={!navDiffNoticeable ? "text-muted-foreground" : navDiff > 0 ? "text-emerald-600" : "text-red-600"}>
                  {fmtCcy(nav, currencyCode)}
                  {navDiffNoticeable && (
                    <> ({navDiff > 0 ? "+" : ""}{((navDiff / nav) * 100).toFixed(2)}%)</>
                  )}
                </span>
              </div>
            </div>
          )}
          <DatePickerInput id="st-date" label="Transfer date" value={date} onChange={setDate} />
          {error && <FieldError>{error}</FieldError>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleDeclare} disabled={saving || !recipientId || shares <= 0 || amount <= 0}>
            {saving && <Spinner className="size-4 mr-2" />}
            Declare transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
