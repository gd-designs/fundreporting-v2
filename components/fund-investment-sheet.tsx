"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, Plus, Pencil, Trash2, MoreHorizontal, Lock } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DatePickerInput } from "@/components/date-input"
import {
  fetchCapTableEntries,
  type CapTableFundChild,
  type CapTableEntry,
  type CapitalCall,
  type ShareClass,
} from "@/lib/cap-table"
import { cn } from "@/lib/utils"

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(n)
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—"
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const CALL_STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
}

const CALL_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
}

// ── Edit Capital Call Dialog ──────────────────────────────────────────────────

function EditCapitalCallDialog({
  open,
  onClose,
  call,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  call: CapitalCall | null
  onSaved: (updated: CapitalCall) => void
}) {
  const [amount, setAmount] = React.useState("")
  const [status, setStatus] = React.useState("pending")
  const [calledAt, setCalledAt] = React.useState<Date | undefined>()
  const [dueDate, setDueDate] = React.useState<Date | undefined>()
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open && call) {
      setAmount(call.amount != null ? String(call.amount) : "")
      setStatus(call.status ?? "pending")
      setCalledAt(call.called_at ? new Date(call.called_at) : undefined)
      setDueDate(call.due_date ? new Date(call.due_date) : undefined)
      setError(null)
    }
  }, [open, call?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!call) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/capital-calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount ? Number(amount) : null,
          status,
          called_at: calledAt ? calledAt.getTime() : null,
          due_date: dueDate ? dueDate.getTime() : null,
        }),
      })
      if (!res.ok) {
        setError("Failed to save.")
        return
      }
      onSaved((await res.json()) as CapitalCall)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Capital Call</DialogTitle>
            <DialogDescription>
              {call ? `${fmtDate(call.called_at)} · ${fmt(call.amount)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DatePickerInput
              id="edit-called"
              label="Called Date"
              value={calledAt}
              onChange={setCalledAt}
            />
            <DatePickerInput
              id="edit-due"
              label="Due Date"
              value={dueDate}
              onChange={setDueDate}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Commitment Dialog ────────────────────────────────────────────────────

function EditCommitmentDialog({
  open,
  onClose,
  entryId,
  currentAmount,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  entryId: string
  currentAmount: number | null
  onSaved: () => void
}) {
  const [amount, setAmount] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setAmount(currentAmount != null ? String(currentAmount) : "")
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/cap-table-entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ committed_amount: amount ? Number(amount) : null }),
      })
      if (!res.ok) {
        setError("Failed to save.")
        return
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-xs">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Commitment</DialogTitle>
            <DialogDescription>Update the total committed amount for this fund investment.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-1.5">
            <Label>Committed Amount</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export function FundInvestmentSheet({
  open,
  onOpenChange,
  ch,
  fund,
  shareholderName,
  shareClasses,
  assetManagerId,
  onIssueCall,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  ch: CapTableFundChild | null
  fund: { id: string; name?: string | null; entity?: string | null } | null
  shareholderName: string
  shareClasses: ShareClass[]
  assetManagerId: string
  onIssueCall?: () => void
  onUpdated?: () => void
}) {
  const [calls, setCalls] = React.useState<CapitalCall[]>([])
  const [fullEntry, setFullEntry] = React.useState<CapTableEntry | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [editingCall, setEditingCall] = React.useState<CapitalCall | null>(null)
  const [editCommitment, setEditCommitment] = React.useState(false)

  const feEntry = ch?._cap_table_entry?.[0] ?? null

  React.useEffect(() => {
    if (!open || !ch) return
    setCalls(feEntry?._capital_call ?? [])

    if (ch.entity && feEntry?.id) {
      setLoading(true)
      fetchCapTableEntries(ch.entity)
        .then((entries) => {
          setFullEntry(entries.find((e) => e.id === feEntry.id) ?? null)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setFullEntry(null)
    }
  }, [open, ch?.id])

  async function deleteCall(id: string) {
    if (!window.confirm("Delete this capital call?")) return
    const res = await fetch(`/api/capital-calls/${id}`, { method: "DELETE" })
    if (res.ok) {
      setCalls((prev) => prev.filter((c) => c.id !== id))
      onUpdated?.()
    }
  }

  if (!ch || !fund) return null

  const committedAmount = feEntry?.committed_amount ?? null
  const totalCalled = calls.reduce((s, c) => s + (c.amount ?? 0), 0)
  const uncalled = Math.max(0, (committedAmount ?? 0) - totalCalled)
  const paidIn = calls.filter((c) => c.status === "paid").reduce((s, c) => s + (c.amount ?? 0), 0)

  const shareClassId = calls[0]?.share_class ?? null
  const sc = shareClasses.find((s) => s.id === shareClassId)
  const currentValue =
    fullEntry?.shares_issued != null && sc?.current_nav != null
      ? fullEntry.shares_issued * sc.current_nav
      : null
  const gl = currentValue != null ? currentValue - totalCalled : null

  const fundHref = `/asset-manager/${assetManagerId}/fund/${fund.id}`

  const stats = [
    { label: "Committed", value: fmt(committedAmount) },
    { label: "Called", value: fmt(totalCalled) },
    { label: "Uncalled", value: uncalled > 0 ? fmt(uncalled) : "—", className: uncalled > 0 ? "text-amber-600" : "" },
    { label: "Paid in", value: fmt(paidIn), className: "text-green-600" },
    {
      label: "Current value",
      value: currentValue != null ? fmt(currentValue) : "—",
      className: currentValue != null ? "" : "text-muted-foreground/50",
    },
    {
      label: "Gain / Loss",
      value: gl != null ? fmt(gl) : "—",
      className: gl != null ? (gl >= 0 ? "text-green-600" : "text-red-600") : "text-muted-foreground/50",
    },
  ]

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="overflow-y-auto w-[90vw]! p-0">
          <div className="flex flex-col">
            {/* Header */}
            <SheetHeader className="shrink-0 px-4 pt-4 pb-3 border-b">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SheetTitle>
                    <Link
                      href={fundHref}
                      className="hover:underline"
                      onClick={() => onOpenChange(false)}
                    >
                      {fund.name ?? "Fund"}
                    </Link>
                  </SheetTitle>
                  <SheetDescription>{shareholderName}</SheetDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    onIssueCall?.()
                  }}
                >
                  <Plus className="size-3.5 mr-1" />
                  Issue call
                </Button>
              </div>
            </SheetHeader>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-px border-b bg-border">
              {stats.map(({ label, value, className }) => (
                <div key={label} className="bg-background px-4 py-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn("text-sm font-semibold tabular-nums mt-0.5", className)}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Share class pill */}
            {(sc || loading) && (
              <div className="px-4 py-2.5 border-b bg-muted/20 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                {loading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : sc ? (
                  <>
                    <span className="font-medium text-foreground">{sc.name}</span>
                    {sc.current_nav != null && (
                      <span>NAV {fmt(sc.current_nav)} / share</span>
                    )}
                    {fullEntry?.shares_issued != null && (
                      <span>{fmt(fullEntry.shares_issued)} shares held</span>
                    )}
                    {fullEntry?.price_per_share != null && (
                      <span>Cost basis {fmt(fullEntry.price_per_share)} / share</span>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {/* Capital calls */}
            <div className="px-4 pt-4 pb-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Capital calls</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setEditCommitment(true)}
                >
                  <Pencil className="size-3" />
                  Edit commitment
                </Button>
              </div>

              {calls.length === 0 ? (
                <div className="rounded-md border border-dashed py-10 text-center">
                  <p className="text-sm text-muted-foreground">No capital calls yet.</p>
                  <button
                    className="text-xs text-muted-foreground underline mt-1"
                    onClick={() => {
                      onOpenChange(false)
                      onIssueCall?.()
                    }}
                  >
                    Issue first call
                  </button>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-muted-foreground">
                        <th className="text-left px-3 py-2 font-medium">Called</th>
                        <th className="text-right px-3 py-2 font-medium">Amount</th>
                        <th className="text-left px-3 py-2 font-medium">Due</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="text-left px-3 py-2 font-medium">Received</th>
                        <th className="text-left px-3 py-2 font-medium">Deployed</th>
                        <th className="w-8 px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {calls.map((cc) => {
                        const isLocked = cc.status !== "pending"
                        const isOverdue =
                          cc.due_date != null &&
                          cc.status === "pending" &&
                          cc.due_date < Date.now()
                        return (
                          <tr key={cc.id} className="hover:bg-muted/20">
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {fmtDate(cc.called_at)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                              {fmt(cc.amount)}
                            </td>
                            <td className="px-3 py-2.5">
                              {cc.due_date ? (
                                <span className={cn(isOverdue && "text-red-500")}>
                                  {fmtDate(cc.due_date)}
                                  {isOverdue && " ⚠"}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {cc.status && (
                                <span
                                  className={cn(
                                    "inline-flex items-center px-1.5 py-0.5 rounded font-medium",
                                    CALL_STATUS_STYLES[cc.status],
                                  )}
                                >
                                  {CALL_STATUS_LABELS[cc.status]}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {fmtDate(cc.received_at)}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {cc.deployed_at ? fmtDate(cc.deployed_at) : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              {isLocked ? (
                                <Lock className="size-3 text-muted-foreground/40" />
                              ) : (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="text-muted-foreground hover:text-foreground p-0.5 rounded">
                                      <MoreHorizontal className="size-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-36">
                                    <DropdownMenuItem onClick={() => setEditingCall(cc)}>
                                      <Pencil className="size-3 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => deleteCall(cc.id)}
                                    >
                                      <Trash2 className="size-3 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <EditCapitalCallDialog
        open={!!editingCall}
        onClose={() => setEditingCall(null)}
        call={editingCall}
        onSaved={(updated) => {
          setCalls((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
          onUpdated?.()
        }}
      />

      <EditCommitmentDialog
        open={editCommitment}
        onClose={() => setEditCommitment(false)}
        entryId={feEntry?.id ?? ""}
        currentAmount={feEntry?.committed_amount ?? null}
        onSaved={() => onUpdated?.()}
      />
    </>
  )
}
