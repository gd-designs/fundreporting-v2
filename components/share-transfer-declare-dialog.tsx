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
  const currentClassNav = sellerEntry.share_class ? scMap.get(sellerEntry.share_class)?.current_nav ?? 0 : 0

  // All three values are user-controlled and saved as-is to share_transfer.
  // Pre-fill: shares = full position, NAV = current class NAV, amount = shares × NAV.
  const [recipientId, setRecipientId] = React.useState("")
  const [sharesToTransfer, setSharesToTransfer] = React.useState(String(sellerAvailableShares))
  const [agreedNav, setAgreedNav] = React.useState(currentClassNav > 0 ? currentClassNav.toFixed(4) : "")
  const [transferAmount, setTransferAmount] = React.useState(currentClassNav > 0 ? (sellerAvailableShares * currentClassNav).toFixed(2) : "")
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setRecipientId("")
      setSharesToTransfer(String(sellerAvailableShares))
      setAgreedNav(currentClassNav > 0 ? currentClassNav.toFixed(4) : "")
      setTransferAmount(currentClassNav > 0 ? (sellerAvailableShares * currentClassNav).toFixed(2) : "")
      setDate(new Date())
      setError(null)
    }
  }, [open, sellerAvailableShares, currentClassNav])

  const shares = sharesToTransfer ? Number(sharesToTransfer) : 0
  const amount = transferAmount ? Number(transferAmount) : 0
  const navValue = agreedNav ? Number(agreedNav) : 0
  // Premium / discount vs the live class NAV (informational, not enforced).
  const navDiff = navValue - currentClassNav
  const navDiffNoticeable = currentClassNav > 0 && Math.abs(navDiff) >= 0.01

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
          nav_per_share: navValue,
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
            {currentClassNav > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current class NAV / share</span>
                <span className="font-medium">{fmtCcy(currentClassNav, currencyCode)}</span>
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
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="st-shares">Shares</FieldLabel>
              <Input
                id="st-shares" type="number" min="0" max={sellerAvailableShares} step="0.0001"
                value={sharesToTransfer}
                onChange={(e) => setSharesToTransfer(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="st-nav">Agreed NAV / share</FieldLabel>
              <Input
                id="st-nav" type="number" min="0" step="0.0001"
                value={agreedNav}
                onChange={(e) => setAgreedNav(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="st-amount">Amount paid ({currencyCode})</FieldLabel>
              <Input
                id="st-amount" type="number" min="0" step="0.01"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
            </Field>
          </div>
          {currentClassNav > 0 && navValue > 0 && (() => {
            const pct = (navDiff / currentClassNav) * 100
            const label = !navDiffNoticeable ? "At NAV" : navDiff > 0 ? "Premium" : "Discount"
            const colorClass = !navDiffNoticeable ? "text-muted-foreground" : navDiff > 0 ? "text-emerald-600" : "text-red-600"
            return (
              <div className="rounded-lg border p-3 bg-muted/30 flex justify-between text-xs">
                <span className="text-muted-foreground">{label} vs. current NAV</span>
                <span className={colorClass}>
                  {navDiffNoticeable
                    ? <>{navDiff > 0 ? "+" : "−"}{fmtCcy(Math.abs(navDiff), currencyCode)} / share ({navDiff > 0 ? "+" : ""}{pct.toFixed(2)}%)</>
                    : "—"}
                </span>
              </div>
            )
          })()}
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
