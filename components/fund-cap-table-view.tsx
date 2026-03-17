"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, MoreHorizontal, Lock, Pencil, Trash2 } from "lucide-react"
import {
  fetchCapitalCalls,
  fetchCapTableEntries,
  fetchShareClasses,
  type CapitalCall,
  type CapTableEntry,
  type ShareClass,
} from "@/lib/cap-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { CapitalCallReceive } from "@/components/capital-call-receive"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { DatePickerInput } from "@/components/date-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import { Spinner as SpinnerSm } from "@/components/ui/spinner"

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: decimals }).format(n)
}

function fmtCurrency(n: number | null | undefined, code = "EUR") {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—"
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
}

// ─── Edit Capital Call Dialog ────────────────────────────────────────────────

function EditCapitalCallDialog({
  open,
  onClose,
  entityUUID,
  call,
  shareClasses,
  currencyCode,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  entityUUID: string
  call: CapitalCall | null
  shareClasses: ShareClass[]
  currencyCode: string
  onSaved: () => void
}) {
  const [amount, setAmount] = React.useState("")
  const [status, setStatus] = React.useState("pending")
  const [calledAt, setCalledAt] = React.useState<Date | undefined>()
  const [dueDate, setDueDate] = React.useState<Date | undefined>()
  const [shareClass, setShareClass] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open && call) {
      setAmount(call.amount != null ? String(call.amount) : "")
      setStatus(call.status ?? "pending")
      setCalledAt(call.called_at ? new Date(call.called_at) : undefined)
      setDueDate(call.due_date ? new Date(call.due_date) : undefined)
      setShareClass(call.share_class ?? "")
      setError(null)
    }
  }, [open, call])

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
          share_class: shareClass || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to save")
      onSaved()
      onClose()
    } catch {
      setError("Failed to save capital call.")
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
          </DialogHeader>
          <FieldGroup className="mt-4">
            <Field>
              <FieldLabel htmlFor="edit-cc-amount">Amount</FieldLabel>
              <Input id="edit-cc-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {shareClasses.length > 0 && (
              <Field>
                <FieldLabel>Share Class</FieldLabel>
                <Select value={shareClass} onValueChange={setShareClass}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {shareClasses.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.name ?? sc.id}{sc.current_nav != null && ` — ${fmtCurrency(sc.current_nav, currencyCode)}/share`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <DatePickerInput id="edit-cc-called" label="Called Date" value={calledAt} onChange={setCalledAt} />
            <DatePickerInput id="edit-cc-due" label="Due Date" value={dueDate} onChange={setDueDate} />
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <SpinnerSm className="size-4" /> : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

type InvestorGroup = {
  entryId: string
  name: string | null
  email: string | null
  committedAmount: number | null
  calls: CapitalCall[]
}

function buildInvestorGroups(calls: CapitalCall[], entries: CapTableEntry[]): InvestorGroup[] {
  const entryMap = new Map<string, CapTableEntry>(entries.map((e) => [e.id, e]))
  const grouped = new Map<string, InvestorGroup>()

  for (const call of calls) {
    if (!call.cap_table_entry) continue
    const entryId = call.cap_table_entry
    if (!grouped.has(entryId)) {
      const entry = entryMap.get(entryId)
      const shareholder = call._cap_table_entry?._shareholder
      grouped.set(entryId, {
        entryId,
        name: shareholder?.name ?? null,
        email: shareholder?.email ?? null,
        committedAmount: call._cap_table_entry?.committed_amount ?? entry?.committed_amount ?? null,
        calls: [],
      })
    }
    grouped.get(entryId)!.calls.push(call)
  }

  // Sort calls within each group by called_at desc
  for (const group of grouped.values()) {
    group.calls.sort((a, b) => (b.called_at ?? 0) - (a.called_at ?? 0))
  }

  return Array.from(grouped.values()).sort((a, b) => (b.committedAmount ?? 0) - (a.committedAmount ?? 0))
}

export function FundCapTableView({
  entityUUID,
  fundName,
  currencyCode = "EUR",
}: {
  entityUUID: string
  fundName?: string
  currencyCode?: string
}) {
  const [calls, setCalls] = React.useState<CapitalCall[]>([])
  const [entries, setEntries] = React.useState<CapTableEntry[]>([])
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())
  const [editDialog, setEditDialog] = React.useState<{ open: boolean; call: CapitalCall | null }>({ open: false, call: null })

  async function load() {
    setLoading(true)
    try {
      const [c, en, sc] = await Promise.all([
        fetchCapitalCalls(entityUUID),
        fetchCapTableEntries(entityUUID),
        fetchShareClasses(entityUUID),
      ])
      setCalls(c)
      setEntries(en)
      setShareClasses(sc)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { void load() }, [entityUUID])

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function deleteCall(id: string) {
    if (!confirm("Delete this capital call?")) return
    await fetch(`/api/capital-calls/${id}`, { method: "DELETE" })
    void load()
  }

  const investors = buildInvestorGroups(calls, entries)

  const totalCommitted = investors.reduce((s, g) => s + (g.committedAmount ?? 0), 0)
  const totalCalled = calls.reduce((s, c) => s + (c.amount ?? 0), 0)
  const totalDeployed = calls.filter((c) => c.deployed_at != null).reduce((s, c) => s + (c.amount ?? 0), 0)
  const totalPending = calls.filter((c) => c.status === "pending" || c.status === "partial").reduce((s, c) => s + (c.amount ?? 0), 0)

  if (loading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-40">
        <Spinner className="size-5" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Investors", value: String(investors.length) },
            { label: "Committed", value: fmtCurrency(totalCommitted, currencyCode) },
            { label: "Called", value: fmtCurrency(totalCalled, currencyCode) },
            { label: "Deployed", value: fmtCurrency(totalDeployed, currencyCode) },
            { label: "Awaiting payment", value: fmtCurrency(totalPending, currencyCode) },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Share Classes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Share Classes</CardTitle>
          </CardHeader>
          <CardContent>
            {shareClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No share classes defined yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {shareClasses.map((sc) => (
                  <div key={sc.id} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm">
                    <span className="font-medium">{sc.name ?? "—"}</span>
                    {sc.current_nav != null && (
                      <span className="text-xs text-muted-foreground">{fmtCurrency(sc.current_nav, currencyCode)}/share</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cap Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cap Table</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {investors.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 pb-6">
                No capital calls issued yet. Issue calls from the Investors tab in the Asset Manager.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="w-6 py-2 px-4"></th>
                    <th className="text-left py-2 px-4 font-medium">Investor</th>
                    <th className="text-right py-2 px-4 font-medium">Committed</th>
                    <th className="text-right py-2 px-4 font-medium">Called</th>
                    <th className="text-right py-2 px-4 font-medium">Uncalled</th>
                    <th className="text-right py-2 px-4 font-medium">Deployed</th>
                    <th className="text-right py-2 px-4 font-medium">Awaiting</th>
                    <th className="py-2 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {investors.map((group) => {
                    const expanded = expandedRows.has(group.entryId)
                    const calledTotal = group.calls.reduce((s, c) => s + (c.amount ?? 0), 0)
                    const deployedTotal = group.calls.filter((c) => c.deployed_at != null).reduce((s, c) => s + (c.amount ?? 0), 0)
                    const awaitingTotal = group.calls.filter((c) => c.status === "pending" || c.status === "partial").reduce((s, c) => s + (c.amount ?? 0), 0)
                    const uncalled = (group.committedAmount ?? 0) - calledTotal

                    return (
                      <React.Fragment key={group.entryId}>
                        <tr className="border-b hover:bg-muted/30">
                          <td className="py-2 px-4">
                            <button onClick={() => toggleRow(group.entryId)} className="text-muted-foreground">
                              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            </button>
                          </td>
                          <td className="py-2 px-4">
                            <div className="font-medium">{group.name ?? "—"}</div>
                            {group.email && <div className="text-xs text-muted-foreground">{group.email}</div>}
                          </td>
                          <td className="py-2 px-4 text-right tabular-nums">{fmtCurrency(group.committedAmount, currencyCode)}</td>
                          <td className="py-2 px-4 text-right tabular-nums">{calledTotal > 0 ? fmtCurrency(calledTotal, currencyCode) : "—"}</td>
                          <td className="py-2 px-4 text-right tabular-nums">{fmtCurrency(uncalled, currencyCode)}</td>
                          <td className="py-2 px-4 text-right tabular-nums">{deployedTotal > 0 ? fmtCurrency(deployedTotal, currencyCode) : "—"}</td>
                          <td className="py-2 px-4 text-right tabular-nums">{awaitingTotal > 0 ? fmtCurrency(awaitingTotal, currencyCode) : "—"}</td>
                          <td className="py-2 px-4">
                            <span className="text-xs text-muted-foreground">{group.calls.length} call{group.calls.length !== 1 ? "s" : ""}</span>
                          </td>
                        </tr>

                        {expanded && group.calls.map((cc) => {
                          const sc = shareClasses.find((s) => s.id === cc.share_class)
                          const sharesForCall = sc?.current_nav && cc.amount ? cc.amount / sc.current_nav : null
                          const now = Date.now()
                          const isOverdue = cc.due_date != null && cc.due_date < now && cc.status !== "paid"
                          const isDeployed = cc.deployed_at != null
                          const isLocked = cc.status !== "pending"
                          const statusLabel = isDeployed ? "Deployed" : cc.status === "paid" ? "Paid" : cc.status === "partial" ? "Partial" : "Pending"
                          const statusClass = isDeployed ? "bg-emerald-100 text-emerald-800" : STATUS_BADGE[cc.status ?? "pending"]

                          return (
                            <tr key={cc.id} className="bg-muted/20 border-b text-xs">
                              <td></td>
                              {/* Called date + share class */}
                              <td className="py-2 px-4 pl-8" colSpan={2}>
                                <div className="font-medium text-foreground">
                                  {cc.called_at ? fmtDate(cc.called_at) : "Pending issue"}
                                </div>
                                {sc && (
                                  <div className="text-muted-foreground text-[11px] mt-0.5">
                                    {sc.name}{sc.current_nav != null && ` · ${fmtCurrency(sc.current_nav, currencyCode)}/share`}
                                    {sharesForCall != null && ` · ${fmt(sharesForCall)} shares`}
                                  </div>
                                )}
                              </td>
                              {/* Amount */}
                              <td className="py-2 px-4 text-right tabular-nums">{fmtCurrency(cc.amount, currencyCode)}</td>
                              {/* Due date */}
                              <td className={`py-2 px-4 text-right tabular-nums ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                {cc.due_date ? fmtDate(cc.due_date) : "—"}
                              </td>
                              {/* Status */}
                              <td className="py-2 px-4 text-right">
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ${statusClass}`}>
                                  {statusLabel}
                                </span>
                              </td>
                              {/* Deploy funds or deployed date */}
                              <td className="py-2 px-4 text-right text-muted-foreground">
                                {cc.received_at
                                  ? fmtDate(cc.received_at)
                                  : cc.status === "paid" && !cc.deployed_at
                                  ? <CapitalCallReceive capitalCall={cc} entityUUID={entityUUID} currencyCode={currencyCode} label="Deploy funds" onSuccess={load} />
                                  : cc.deployed_at ? fmtDate(cc.deployed_at) : "—"}
                              </td>
                              {/* Actions */}
                              <td className="py-2 px-4">
                                <div className="flex items-center justify-end">
                                  {isDeployed ? (
                                    <Lock className="size-3 text-muted-foreground/40" />
                                  ) : (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="size-6">
                                          <MoreHorizontal className="size-3.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setEditDialog({ open: true, call: cc })}>
                                          <Pencil className="size-3.5 mr-2" /> Edit
                                        </DropdownMenuItem>
                                        {!isLocked && (
                                          <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteCall(cc.id)}>
                                              <Trash2 className="size-3.5 mr-2" /> Delete
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}

                        {expanded && group.calls.length === 0 && (
                          <tr className="bg-muted/20 border-b">
                            <td colSpan={8} className="py-2 px-4 pl-8 text-xs text-muted-foreground">
                              No capital calls recorded for this investor.
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t text-xs font-medium">
                    <td colSpan={2} className="py-2 px-4 text-muted-foreground">Total</td>
                    <td className="py-2 px-4 text-right tabular-nums">{fmtCurrency(totalCommitted, currencyCode)}</td>
                    <td className="py-2 px-4 text-right tabular-nums">{totalCalled > 0 ? fmtCurrency(totalCalled, currencyCode) : "—"}</td>
                    <td className="py-2 px-4 text-right tabular-nums">{fmtCurrency(totalCommitted - totalCalled, currencyCode)}</td>
                    <td className="py-2 px-4 text-right tabular-nums">{totalDeployed > 0 ? fmtCurrency(totalDeployed, currencyCode) : "—"}</td>
                    <td className="py-2 px-4 text-right tabular-nums">{totalPending > 0 ? fmtCurrency(totalPending, currencyCode) : "—"}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>

      </div>

      <EditCapitalCallDialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, call: null })}
        entityUUID={entityUUID}
        call={editDialog.call}
        shareClasses={shareClasses}
        currencyCode={currencyCode}
        onSaved={load}
      />
    </div>
  )
}
