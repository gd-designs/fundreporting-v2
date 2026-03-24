"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, MoreHorizontal, Lock, Pencil, Trash2, UserPlus } from "lucide-react"
import {
  fetchCapitalCalls,
  fetchCapTableEntries,
  fetchCapTableShareholders,
  fetchShareClasses,
  type CapitalCall,
  type CapTableEntry,
  type CapTableShareholder,
  type ShareClass,
} from "@/lib/cap-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { CapitalCallReceive } from "@/components/capital-call-receive"
import { AddFundInvestorDialog } from "@/components/add-fund-investor-dialog"
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

// ─── Data grouping ───────────────────────────────────────────────────────────

type EntryGroup = {
  entry: CapTableEntry
  calls: CapitalCall[]
}

type ShareholderGroup = {
  shareholder: CapTableShareholder
  entries: EntryGroup[]
  // Aggregated across all entries
  totalCommitted: number
  totalCalled: number
  totalDeployed: number
  totalPending: number
}

function buildShareholderGroups(
  shareholders: CapTableShareholder[],
  entries: CapTableEntry[],
  calls: CapitalCall[],
): ShareholderGroup[] {
  // Index calls by entry id
  const callsByEntry = new Map<string, CapitalCall[]>()
  for (const call of calls) {
    if (!call.cap_table_entry) continue
    if (!callsByEntry.has(call.cap_table_entry)) callsByEntry.set(call.cap_table_entry, [])
    callsByEntry.get(call.cap_table_entry)!.push(call)
  }
  for (const list of callsByEntry.values()) {
    list.sort((a, b) => (b.called_at ?? 0) - (a.called_at ?? 0))
  }

  // Index entries by shareholder id
  const entriesByShareholder = new Map<string, CapTableEntry[]>()
  for (const entry of entries) {
    if (!entry.shareholder) continue
    if (!entriesByShareholder.has(entry.shareholder)) entriesByShareholder.set(entry.shareholder, [])
    entriesByShareholder.get(entry.shareholder)!.push(entry)
  }
  for (const list of entriesByShareholder.values()) {
    list.sort((a, b) => (a.issued_at ?? 0) - (b.issued_at ?? 0))
  }

  return shareholders
    .filter((sh) => sh.type !== "fund")
    .map((sh) => {
      const entryGroups: EntryGroup[] = (entriesByShareholder.get(sh.id) ?? []).map((entry) => ({
        entry,
        calls: callsByEntry.get(entry.id) ?? [],
      }))

      const allCalls = entryGroups.flatMap((eg) => eg.calls)
      return {
        shareholder: sh,
        entries: entryGroups,
        totalCommitted: entryGroups.reduce((s, eg) => s + (eg.entry.committed_amount ?? 0), 0),
        totalCalled: allCalls.reduce((s, c) => s + (c.amount ?? 0), 0),
        totalDeployed: allCalls.filter((c) => c.deployed_at != null).reduce((s, c) => s + (c.amount ?? 0), 0),
        totalPending: allCalls.filter((c) => c.status === "pending" || c.status === "partial").reduce((s, c) => s + (c.amount ?? 0), 0),
      }
    })
    .sort((a, b) => b.totalCommitted - a.totalCommitted)
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function FundCapTableView({
  fundId,
  entityUUID,
  amEntityUUID,
  amRecordId,
  fundName,
  currencyCode = "EUR",
}: {
  fundId?: string
  entityUUID: string
  amEntityUUID?: string | null
  amRecordId?: string | null
  fundName?: string
  currencyCode?: string
}) {
  const [calls, setCalls] = React.useState<CapitalCall[]>([])
  const [entries, setEntries] = React.useState<CapTableEntry[]>([])
  const [shareholders, setShareholders] = React.useState<CapTableShareholder[]>([])
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([])
  const [loading, setLoading] = React.useState(true)
  // Keys: "sh:{id}" for shareholder rows, "entry:{id}" for entry rows
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())
  const [editDialog, setEditDialog] = React.useState<{ open: boolean; call: CapitalCall | null }>({ open: false, call: null })
  const [addInvestorOpen, setAddInvestorOpen] = React.useState(false)

  async function load() {
    setLoading(true)
    try {
      const [c, en, sh, sc] = await Promise.all([
        fetchCapitalCalls(entityUUID),
        fetchCapTableEntries(entityUUID),
        fetchCapTableShareholders(entityUUID),
        fetchShareClasses(entityUUID),
      ])
      setCalls(c)
      setEntries(en)
      setShareholders(sh)
      setShareClasses(sc)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { void load() }, [entityUUID])

  function toggle(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  async function deleteCall(id: string) {
    if (!confirm("Delete this capital call?")) return
    await fetch(`/api/capital-calls/${id}`, { method: "DELETE" })
    void load()
  }

  const groups = buildShareholderGroups(shareholders, entries, calls)
  const fundInvestors = shareholders.filter((sh) => sh.type === "fund")

  const totalCommitted = groups.reduce((s, g) => s + g.totalCommitted, 0)
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

  const isEmpty = groups.length === 0 && fundInvestors.length === 0

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Investors", value: String(groups.length + fundInvestors.length) },
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
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Cap Table</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAddInvestorOpen(true)}>
              <UserPlus className="size-3.5 mr-1.5" />
              Add investor
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {isEmpty ? (
              <div className="px-6 pb-6 flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">No investors added yet.</p>
                <Button size="sm" variant="outline" className="w-fit" onClick={() => setAddInvestorOpen(true)}>
                  <UserPlus className="size-3.5 mr-1.5" />
                  Add first investor
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="w-6 py-2 px-3"></th>
                    <th className="text-left py-2 px-3 font-medium">Investor</th>
                    <th className="text-right py-2 px-3 font-medium">Committed</th>
                    <th className="text-right py-2 px-3 font-medium">Called</th>
                    <th className="text-right py-2 px-3 font-medium">Uncalled</th>
                    <th className="text-right py-2 px-3 font-medium">Deployed</th>
                    <th className="text-right py-2 px-3 font-medium">Awaiting</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>

                  {/* ── Fund investors (reporting-only, no entries/calls) ── */}
                  {fundInvestors.map((sh) => (
                    <tr key={sh.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3"></td>
                      <td className="py-2 px-3">
                        <div className="font-medium flex items-center gap-2">
                          {sh.name ?? "—"}
                          <span className="text-[10px] font-medium bg-violet-100 text-violet-700 rounded-full px-1.5 py-0.5">Fund</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right text-muted-foreground text-xs" colSpan={5}>Reporting only — no capital calls</td>
                      <td className="py-2 px-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-6">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={async () => {
                                if (!confirm(`Remove ${sh.name ?? "this fund"} from the cap table?`)) return
                                await fetch(`/api/cap-table-shareholders/${sh.id}`, { method: "DELETE" })
                                void load()
                              }}
                            >
                              <Trash2 className="size-3.5 mr-2" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}

                  {/* ── Regular investors grouped by shareholder ── */}
                  {groups.map((group) => {
                    const shKey = `sh:${group.shareholder.id}`
                    const shExpanded = expandedRows.has(shKey)
                    const uncalled = group.totalCommitted - group.totalCalled
                    const entryCount = group.entries.length

                    return (
                      <React.Fragment key={group.shareholder.id}>

                        {/* Shareholder row */}
                        <tr className="border-b hover:bg-muted/30 font-medium">
                          <td className="py-2.5 px-3">
                            <button onClick={() => toggle(shKey)} className="text-muted-foreground">
                              {shExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            </button>
                          </td>
                          <td className="py-2.5 px-3">
                            <div>{group.shareholder.name ?? "—"}</div>
                            {group.shareholder.email && (
                              <div className="text-xs font-normal text-muted-foreground">{group.shareholder.email}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{fmtCurrency(group.totalCommitted, currencyCode)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{group.totalCalled > 0 ? fmtCurrency(group.totalCalled, currencyCode) : "—"}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{fmtCurrency(uncalled, currencyCode)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{group.totalDeployed > 0 ? fmtCurrency(group.totalDeployed, currencyCode) : "—"}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{group.totalPending > 0 ? fmtCurrency(group.totalPending, currencyCode) : "—"}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="text-xs font-normal text-muted-foreground">
                              {entryCount} round{entryCount !== 1 ? "s" : ""}
                            </span>
                          </td>
                        </tr>

                        {/* Entry rows (visible when shareholder expanded) */}
                        {shExpanded && group.entries.map((eg) => {
                          const entryKey = `entry:${eg.entry.id}`
                          const entryExpanded = expandedRows.has(entryKey)
                          const sc = shareClasses.find((s) => s.id === eg.entry.share_class)
                          const entryCalled = eg.calls.reduce((s, c) => s + (c.amount ?? 0), 0)
                          const entryDeployed = eg.calls.filter((c) => c.deployed_at != null).reduce((s, c) => s + (c.amount ?? 0), 0)
                          const entryPending = eg.calls.filter((c) => c.status === "pending" || c.status === "partial").reduce((s, c) => s + (c.amount ?? 0), 0)
                          const entryUncalled = (eg.entry.committed_amount ?? 0) - entryCalled

                          return (
                            <React.Fragment key={eg.entry.id}>
                              {/* Entry row */}
                              <tr className="border-b bg-muted/10 hover:bg-muted/20 text-sm">
                                <td className="py-2 px-3 pl-8">
                                  <button onClick={() => toggle(entryKey)} className="text-muted-foreground">
                                    {entryExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                                  </button>
                                </td>
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">
                                      {eg.entry.round_label ?? (eg.entry.issued_at ? fmtDate(eg.entry.issued_at) : "Entry")}
                                    </span>
                                    {sc && (
                                      <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{sc.name}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{fmtCurrency(eg.entry.committed_amount, currencyCode)}</td>
                                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{entryCalled > 0 ? fmtCurrency(entryCalled, currencyCode) : "—"}</td>
                                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{fmtCurrency(entryUncalled, currencyCode)}</td>
                                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{entryDeployed > 0 ? fmtCurrency(entryDeployed, currencyCode) : "—"}</td>
                                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{entryPending > 0 ? fmtCurrency(entryPending, currencyCode) : "—"}</td>
                                <td className="py-2 px-3 text-right">
                                  <span className="text-xs text-muted-foreground">
                                    {eg.calls.length} call{eg.calls.length !== 1 ? "s" : ""}
                                  </span>
                                </td>
                              </tr>

                              {/* Capital call rows (visible when entry expanded) */}
                              {entryExpanded && eg.calls.map((cc) => {
                                const callSc = shareClasses.find((s) => s.id === cc.share_class)
                                const sharesForCall = callSc?.current_nav && cc.amount ? cc.amount / callSc.current_nav : null
                                const now = Date.now()
                                const isOverdue = cc.due_date != null && cc.due_date < now && cc.status !== "paid"
                                const isDeployed = cc.deployed_at != null
                                const isLocked = cc.status !== "pending"
                                const statusLabel = isDeployed ? "Deployed" : cc.status === "paid" ? "Paid" : cc.status === "partial" ? "Partial" : "Pending"
                                const statusClass = isDeployed ? "bg-emerald-100 text-emerald-800" : STATUS_BADGE[cc.status ?? "pending"]

                                return (
                                  <tr key={cc.id} className="bg-muted/20 border-b text-xs">
                                    <td colSpan={2} className="py-2 px-3 pl-14">
                                      <div className="font-medium text-foreground">
                                        {cc.called_at ? fmtDate(cc.called_at) : "Pending issue"}
                                      </div>
                                      {callSc && (
                                        <div className="text-muted-foreground text-[11px] mt-0.5">
                                          {callSc.name}{callSc.current_nav != null && ` · ${fmtCurrency(callSc.current_nav, currencyCode)}/share`}
                                          {sharesForCall != null && ` · ${fmt(sharesForCall)} shares`}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">{fmtCurrency(cc.amount, currencyCode)}</td>
                                    <td className={`py-2 px-3 text-right tabular-nums ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                      {cc.due_date ? fmtDate(cc.due_date) : "—"}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ${statusClass}`}>
                                        {statusLabel}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right text-muted-foreground">
                                      {cc.received_at
                                        ? fmtDate(cc.received_at)
                                        : cc.status === "paid" && !cc.deployed_at
                                        ? <CapitalCallReceive capitalCall={cc} entityUUID={entityUUID} currencyCode={currencyCode} label="Deploy funds" onSuccess={load} />
                                        : cc.deployed_at ? fmtDate(cc.deployed_at) : "—"}
                                    </td>
                                    <td className="py-2 px-3"></td>
                                    <td className="py-2 px-3">
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

                              {entryExpanded && eg.calls.length === 0 && (
                                <tr className="bg-muted/20 border-b">
                                  <td colSpan={8} className="py-2 px-3 pl-14 text-xs text-muted-foreground">
                                    No capital calls for this round.
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}

                        {shExpanded && group.entries.length === 0 && (
                          <tr className="bg-muted/10 border-b">
                            <td colSpan={8} className="py-2 px-3 pl-8 text-xs text-muted-foreground">
                              No investment entries recorded.
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t text-xs font-medium">
                    <td colSpan={2} className="py-2 px-3 text-muted-foreground">Total</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmtCurrency(totalCommitted, currencyCode)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{totalCalled > 0 ? fmtCurrency(totalCalled, currencyCode) : "—"}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmtCurrency(totalCommitted - totalCalled, currencyCode)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{totalDeployed > 0 ? fmtCurrency(totalDeployed, currencyCode) : "—"}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{totalPending > 0 ? fmtCurrency(totalPending, currencyCode) : "—"}</td>
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

      <AddFundInvestorDialog
        open={addInvestorOpen}
        onClose={() => setAddInvestorOpen(false)}
        fundId={fundId}
        fundEntityUUID={entityUUID}
        amEntityUUID={amEntityUUID ?? null}
        amRecordId={amRecordId ?? null}
        shareClasses={shareClasses}
        currencyCode={currencyCode}
        onSuccess={load}
      />
    </div>
  )
}
