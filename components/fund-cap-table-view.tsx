"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { ChevronDown, ChevronRight, MoreHorizontal, Lock, Pencil, Plus, Trash2, UserPlus, RefreshCw, ArrowRightLeft } from "lucide-react"
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
import { ReinvestDialog } from "@/components/reinvest-dialog"
import { ShareTransferDeclareDialog, type RecipientOption } from "@/components/share-transfer-declare-dialog"
import { AddShareClassDialog } from "@/components/add-share-class-dialog"
import { EditShareClassDialog } from "@/components/edit-share-class-dialog"
import { CapTableInvestorSheet } from "@/components/cap-table-investor-sheet"
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
  entryShareClass,
  shareClasses,
  currencyCode,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  entityUUID: string
  call: CapitalCall | null
  entryShareClass?: string | null
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
      setShareClass(call.share_class ?? entryShareClass ?? "")
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

// ─── Edit Entry Dialog ────────────────────────────────────────────────────────

function EditEntryDialog({
  open,
  onClose,
  entry,
  shareClasses,
  currencyCode,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  entry: CapTableEntry | null
  shareClasses: ShareClass[]
  currencyCode: string
  onSaved: () => void
}) {
  const [issuedAt, setIssuedAt] = React.useState<Date | undefined>()
  const [committedAmount, setCommittedAmount] = React.useState("")
  const [shareClass, setShareClass] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open && entry) {
      setIssuedAt(entry.issued_at ? new Date(entry.issued_at) : undefined)
      setCommittedAmount(entry.committed_amount != null ? String(entry.committed_amount) : "")
      setShareClass(entry.share_class ?? "")
      setError(null)
    }
  }, [open, entry])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!entry) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/cap-table-entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issued_at: issuedAt ? issuedAt.getTime() : null,
          committed_amount: committedAmount ? Number(committedAmount) : null,
          share_class: shareClass || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to save")
      onSaved()
      onClose()
    } catch {
      setError("Failed to save entry.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
          </DialogHeader>
          <FieldGroup className="mt-4">
            <DatePickerInput id="edit-entry-issued" label="Entry Date" value={issuedAt} onChange={setIssuedAt} />
            <Field>
              <FieldLabel htmlFor="edit-entry-committed">Committed Amount ({currencyCode})</FieldLabel>
              <Input id="edit-entry-committed" type="number" min="0" step="0.01" value={committedAmount} onChange={(e) => setCommittedAmount(e.target.value)} />
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
  liveValue: number
  netShares: number
}


type ShareholderGroup = {
  shareholder: CapTableShareholder
  entries: EntryGroup[]
  // Aggregated across all entries
  totalCommitted: number
  totalCalled: number
  totalDeployed: number
  totalLiveValue: number
  totalShares: number
}

function buildShareholderGroups(
  shareholders: CapTableShareholder[],
  entries: CapTableEntry[],
  calls: CapitalCall[],
  liveValueByEntry: Map<string, number>,
  sharesByEntry: Map<string, number>,
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
    .map((sh) => {
      const entryGroups: EntryGroup[] = (entriesByShareholder.get(sh.id) ?? []).map((entry) => ({
        entry,
        calls: callsByEntry.get(entry.id) ?? [],
        liveValue: liveValueByEntry.get(entry.id) ?? 0,
        netShares: sharesByEntry.get(entry.id) ?? 0,
      }))

      const allCalls = entryGroups.flatMap((eg) => eg.calls)
      const totalCalled = allCalls.reduce((s, c) => s + (c.amount ?? 0), 0)
      const rawCommitted = entryGroups.reduce((s, eg) => s + (eg.entry.committed_amount ?? 0), 0)
      return {
        shareholder: sh,
        entries: entryGroups,
        totalCommitted: Math.max(rawCommitted, totalCalled),
        totalCalled,
        totalDeployed: allCalls.filter((c) => c.deployed_at != null).reduce((s, c) => s + (c.amount ?? 0), 0),
        totalLiveValue: entryGroups.reduce((s, eg) => s + eg.liveValue, 0),
        totalShares: entryGroups.reduce((s, eg) => s + eg.netShares, 0),
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
  const [mutations, setMutations] = React.useState<Array<{ id?: string | null; cap_table_entry?: string | null; type?: string | null; shares_issued?: number | null; shares_redeemed?: number | null; nav_per_share?: number | null; notes?: string | null; mutation_at?: number | null }>>([])
  type PayoutRecord = {
    id: string
    cap_table_entry?: string | null
    type?: "distribution" | "redemption" | null
    amount?: number | null
    status?: "pending" | "paid" | null
    declared_at?: number | null
    paid_at?: number | null
    shares_redeemed?: number | null
  }
  type TransferRecord = {
    id: string
    seller_cap_table_entry?: string | null
    buyer_cap_table_entry?: string | null
    seller_mutation?: string | null
    buyer_mutation?: string | null
    shares?: number | null
    amount?: number | null
    nav_per_share?: number | null
    transferred_at?: number | null
    status?: "pending" | "executed" | "reversed" | null
  }
  const [payouts, setPayouts] = React.useState<PayoutRecord[]>([])
  const [transfers, setTransfers] = React.useState<TransferRecord[]>([])
  // Currency lookup (id → ISO code), and FX rates from foreign currencies → fund currency.
  const [currencyMap, setCurrencyMap] = React.useState<Map<number, string>>(new Map())
  const [fxRates, setFxRates] = React.useState<Record<string, number>>({})
  const [loading, setLoading] = React.useState(true)
  // Keys: "sh:{id}" for shareholder rows, "entry:{id}" for entry rows
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())
  const [editDialog, setEditDialog] = React.useState<{ open: boolean; call: CapitalCall | null; entryShareClass: string | null }>({ open: false, call: null, entryShareClass: null })
  const [editEntryDialog, setEditEntryDialog] = React.useState<{ open: boolean; entry: CapTableEntry | null }>({ open: false, entry: null })
  const [reinvestDialog, setReinvestDialog] = React.useState<{ open: boolean; shareholder: CapTableShareholder | null; entry: CapTableEntry | null }>({ open: false, shareholder: null, entry: null })
  const [transferDialog, setTransferDialog] = React.useState<{ open: boolean; shareholder: CapTableShareholder | null; entry: CapTableEntry | null; netShares: number }>({ open: false, shareholder: null, entry: null, netShares: 0 })
  const [executingTransferId, setExecutingTransferId] = React.useState<string | null>(null)
  // "all" or a specific ISO code (e.g. "USD") — filters the cap table to entries in that currency.
  const [currencyFilter, setCurrencyFilter] = React.useState<string>("all")

  async function executeTransfer(id: string) {
    if (!confirm("Execute this transfer now? This will create the fund mutations and ledger entries on both sides.")) return
    setExecutingTransferId(id)
    try {
      const res = await fetch("/api/fund-share-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareTransferId: id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        alert(err.error ?? "Failed to execute transfer")
        return
      }
      void load()
    } finally {
      setExecutingTransferId(null)
    }
  }
  const [addInvestorOpen, setAddInvestorOpen] = React.useState(false)
  const [addShareClassOpen, setAddShareClassOpen] = React.useState(false)
  const [editShareClass, setEditShareClass] = React.useState<ShareClass | null>(null)
  const [investorSheet, setInvestorSheet] = React.useState<{ open: boolean; shareholder: CapTableShareholder | null }>({ open: false, shareholder: null })

  async function load() {
    setLoading(true)
    try {
      const [c, en, sh, sc, muts, po, tr, currencies] = await Promise.all([
        fetchCapitalCalls(entityUUID),
        fetchCapTableEntries(entityUUID),
        fetchCapTableShareholders(entityUUID),
        fetchShareClasses(entityUUID),
        fetch(`/api/fund-mutations?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch(`/api/fund-payouts?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []).catch(() => []),
        Promise.all([
          fetch(`/api/share-transfers?entity=${entityUUID}&status=pending`).then((r) => r.ok ? r.json() : []).catch(() => []),
          fetch(`/api/share-transfers?entity=${entityUUID}&status=executed`).then((r) => r.ok ? r.json() : []),
        ]).then(([p, e]) => [...(Array.isArray(p) ? p : []), ...(Array.isArray(e) ? e : [])]),
        fetch("/api/currencies").then((r) => r.ok ? r.json() : []).catch(() => []),
      ])
      setCalls(c)
      setEntries(en)
      setShareholders(sh)
      setShareClasses(sc)
      setMutations(Array.isArray(muts) ? muts : [])
      setPayouts(Array.isArray(po) ? po : [])
      setTransfers(Array.isArray(tr) ? tr : [])

      // Build id→code map for currencies
      const cmap = new Map<number, string>()
      for (const cu of (currencies as Array<{ id: number; code?: string | null }>)) {
        if (cu.code) cmap.set(cu.id, cu.code)
      }
      setCurrencyMap(cmap)

      // Fetch FX rates for any non-fund currencies that appear on entries
      const fundCode = (currencyCode || "EUR").toUpperCase()
      const foreignCodes = Array.from(
        new Set(
          (en as CapTableEntry[])
            .map((e) => (e.currency != null ? cmap.get(e.currency) : null))
            .filter((code): code is string => !!code && code.toUpperCase() !== fundCode),
        ),
      )
      if (foreignCodes.length > 0) {
        try {
          const fxRes = await fetch(`/api/fx?base=${fundCode}&from=${foreignCodes.join(",")}`)
          if (fxRes.ok) {
            const fx = (await fxRes.json()) as { rates?: Record<string, number> }
            setFxRates(fx.rates ?? {})
          }
        } catch {
          /* ignore — fall back to no conversion */
        }
      } else {
        setFxRates({})
      }
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { void load() }, [entityUUID])

  // Auto-open the investor sheet when ?cap={shareholderId} is in the URL
  const searchParams = useSearchParams()
  const capParam = searchParams?.get("cap")
  React.useEffect(() => {
    if (!capParam || shareholders.length === 0) return
    const match = shareholders.find((s) => s.id === capParam)
    if (match) setInvestorSheet({ open: true, shareholder: match })
  }, [capParam, shareholders])

  function toggle(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const [deletingCallId, setDeletingCallId] = React.useState<string | null>(null)

  async function deleteCall(id: string) {
    setDeletingCallId(id)
    try {
      const res = await fetch(`/api/capital-calls/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        alert(err.error ?? "Failed to delete capital call")
        return
      }
      void load()
    } finally {
      setDeletingCallId(null)
    }
  }

  // Net shares per entry from fund_mutation records.
  // Also adds executed share_transfer deltas when their paired fund_mutation is
  // missing (e.g. legacy transfers recorded before the current endpoint, or
  // where one side's mutation creation failed silently).
  const sharesByEntryMap = React.useMemo(() => {
    const result = new Map<string, number>()
    const mutationIds = new Set<string>()
    for (const m of mutations) {
      if (m.id) mutationIds.add(m.id)
      const entryId = m.cap_table_entry
      if (!entryId) continue
      const delta = (m.shares_issued ?? 0) - (m.shares_redeemed ?? 0)
      result.set(entryId, (result.get(entryId) ?? 0) + delta)
    }
    for (const t of transfers) {
      if (t.status !== "executed") continue
      const shares = t.shares ?? 0
      if (shares <= 0) continue
      if (t.seller_cap_table_entry && (!t.seller_mutation || !mutationIds.has(t.seller_mutation))) {
        result.set(t.seller_cap_table_entry, (result.get(t.seller_cap_table_entry) ?? 0) - shares)
      }
      if (t.buyer_cap_table_entry && (!t.buyer_mutation || !mutationIds.has(t.buyer_mutation))) {
        result.set(t.buyer_cap_table_entry, (result.get(t.buyer_cap_table_entry) ?? 0) + shares)
      }
    }
    return result
  }, [mutations, transfers])

  // Live value per entry = net shares * current share class NAV.
  // Falls back to deployed amount ONLY when this entry has no fund_mutation history
  // (legacy / migration data). If mutations exist and net to 0, the position is
  // fully closed — live value must be 0, not the deployed fallback.
  const liveValueByEntry = React.useMemo(() => {
    const entriesWithMutations = new Set<string>()
    for (const m of mutations) {
      if (m.cap_table_entry) entriesWithMutations.add(m.cap_table_entry)
    }
    const result = new Map<string, number>()
    for (const entry of entries) {
      const sc = shareClasses.find((s) => s.id === entry.share_class)
      const nav = sc?.current_nav ?? null
      const netShares = sharesByEntryMap.get(entry.id) ?? 0
      if (nav != null && netShares > 0.0001) {
        result.set(entry.id, netShares * nav)
      } else if (entriesWithMutations.has(entry.id)) {
        // Mutations exist for this entry but net to ~0 → position closed
        result.set(entry.id, 0)
      } else {
        // No mutation history at all — fall back to deployed amount (legacy data)
        const deployedOnEntry = calls
          .filter((c) => c.cap_table_entry === entry.id && c.deployed_at != null)
          .reduce((s, c) => s + (c.amount ?? 0), 0)
        result.set(entry.id, deployedOnEntry)
      }
    }
    return result
  }, [sharesByEntryMap, entries, shareClasses, calls, mutations])

  const allGroups = buildShareholderGroups(shareholders, entries, calls, liveValueByEntry, sharesByEntryMap)

  // Per-entry currency code — falls back to the fund's currency.
  const fundCode = (currencyCode || "EUR").toUpperCase()
  const entryCurrencyCode = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) {
      const code = e.currency != null ? currencyMap.get(e.currency) : null
      map.set(e.id, (code ?? fundCode).toUpperCase())
    }
    return map
  }, [entries, currencyMap, fundCode])

  // All distinct currencies present on cap table entries (for the filter dropdown).
  const availableCurrencies = React.useMemo(() => {
    const set = new Set<string>()
    for (const code of entryCurrencyCode.values()) set.add(code)
    return Array.from(set).sort()
  }, [entryCurrencyCode])

  // Apply currency filter: drop entries whose currency doesn't match, then drop
  // shareholders left with no entries.
  const groups = React.useMemo(() => {
    if (currencyFilter === "all") return allGroups
    return allGroups
      .map((g) => ({
        ...g,
        entries: g.entries.filter((eg) => entryCurrencyCode.get(eg.entry.id) === currencyFilter),
      }))
      .filter((g) => g.entries.length > 0)
      .map((g) => ({
        ...g,
        totalLiveValue: g.entries.reduce((s, eg) => s + eg.liveValue, 0),
        totalShares: g.entries.reduce((s, eg) => s + eg.netShares, 0),
        totalCommitted: g.entries.reduce((s, eg) => s + (eg.entry.committed_amount ?? 0), 0),
        totalCalled: g.entries.flatMap((eg) => eg.calls).reduce((s, c) => s + (c.amount ?? 0), 0),
        totalDeployed: g.entries.flatMap((eg) => eg.calls).filter((c) => c.deployed_at != null).reduce((s, c) => s + (c.amount ?? 0), 0),
      }))
  }, [allGroups, currencyFilter, entryCurrencyCode])

  // Convert an amount in `fromCode` to the fund's currency using fetched FX rates.
  const toFundCurrency = React.useCallback(
    (amount: number, fromCode: string): number => {
      if (!amount || fromCode === fundCode) return amount
      const rate = fxRates[fromCode]
      if (!rate) return amount // FX unavailable — show raw value rather than hide
      return amount * rate
    },
    [fundCode, fxRates],
  )

  // Deployed = deployed capital_call.amount + executed share_transfer net flow.
  // Buyer inherits already-deployed capital (auto-deployed); seller loses deployed.
  const deployedByEntry = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const cc of calls) {
      if (!cc.cap_table_entry || cc.deployed_at == null) continue
      map.set(cc.cap_table_entry, (map.get(cc.cap_table_entry) ?? 0) + (cc.amount ?? 0))
    }
    for (const t of transfers) {
      if (t.status !== "executed") continue
      const amt = t.amount ?? 0
      if (t.buyer_cap_table_entry) {
        map.set(t.buyer_cap_table_entry, (map.get(t.buyer_cap_table_entry) ?? 0) + amt)
      }
      if (t.seller_cap_table_entry) {
        map.set(t.seller_cap_table_entry, (map.get(t.seller_cap_table_entry) ?? 0) - amt)
      }
    }
    return map
  }, [calls, transfers])

  // Per-entry historical NAV — taken from the first non-transfer subscription mutation.
  // Used to display capital-call shares at the price they were actually issued at,
  // not at the current (possibly inflated) NAV.
  const originalNavByEntry = React.useMemo(() => {
    const map = new Map<string, number>()
    // Transfer-in mutations are priced at the transfer's NAV, not the original
    // subscription's, so exclude them by checking notes prefix.
    const subs = mutations
      .filter((m) =>
        m.cap_table_entry &&
        m.type === "subscription" &&
        (m.nav_per_share ?? 0) > 0 &&
        !(typeof m.notes === "string" && /^transfer (to|from)/i.test(m.notes)),
      )
      .sort((a, b) => (a.mutation_at ?? 0) - (b.mutation_at ?? 0))
    for (const m of subs) {
      const entryId = m.cap_table_entry!
      if (map.has(entryId)) continue
      map.set(entryId, m.nav_per_share!)
    }
    return map
  }, [mutations])

  // Paid = sum of paid/deployed capital_call.amount + executed share_transfer amounts
  // (buyer side adds, seller side subtracts) per entry
  const paidByEntry = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const cc of calls) {
      if (!cc.cap_table_entry) continue
      const isPaid = cc.status === "paid" || cc.deployed_at != null
      if (!isPaid) continue
      map.set(cc.cap_table_entry, (map.get(cc.cap_table_entry) ?? 0) + (cc.amount ?? 0))
    }
    for (const t of transfers) {
      if (t.status !== "executed") continue
      const amt = t.amount ?? 0
      if (t.buyer_cap_table_entry) {
        map.set(t.buyer_cap_table_entry, (map.get(t.buyer_cap_table_entry) ?? 0) + amt)
      }
      if (t.seller_cap_table_entry) {
        map.set(t.seller_cap_table_entry, (map.get(t.seller_cap_table_entry) ?? 0) - amt)
      }
    }
    return map
  }, [calls, transfers])

  // Distributed / Redeemed = sum of fund_payout.amount per entry, by type.
  // Includes pending + paid because the underlying fund_mutation already reduced
  // shares at declaration time — keeping these in sync with the share count.
  const distributedByEntry = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const p of payouts) {
      if (!p.cap_table_entry || p.type !== "distribution") continue
      map.set(p.cap_table_entry, (map.get(p.cap_table_entry) ?? 0) + (p.amount ?? 0))
    }
    return map
  }, [payouts])

  const redeemedByEntry = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const p of payouts) {
      if (!p.cap_table_entry || p.type !== "redemption") continue
      map.set(p.cap_table_entry, (map.get(p.cap_table_entry) ?? 0) + (p.amount ?? 0))
    }
    return map
  }, [payouts])

  // Lookup: cap_table_entry id → shareholder name (for transfer counter-party display)
  const nameByEntryId = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) {
      const sh = shareholders.find((s) => s.id === e.shareholder)
      if (sh?.name) map.set(e.id, sh.name)
    }
    return map
  }, [entries, shareholders])

  // Movements per entry: capital calls + fund_payouts + share_transfers.
  // Each kind is a separate union member (single literal) so TS narrows cleanly.
  type Movement =
    | { kind: "call"; date: number; amount: number; call: CapitalCall }
    | { kind: "distribution"; date: number; amount: number; status: "pending" | "paid"; payout: PayoutRecord }
    | { kind: "redemption"; date: number; amount: number; status: "pending" | "paid"; payout: PayoutRecord }
    | { kind: "transfer_out"; date: number; shares: number; amount: number; navPerShare: number; counterpartyName: string; status: "pending" | "executed" | "reversed"; transfer: TransferRecord }
    | { kind: "transfer_in"; date: number; shares: number; amount: number; navPerShare: number; counterpartyName: string; status: "pending" | "executed" | "reversed"; transfer: TransferRecord }

  const movementsByEntry = React.useMemo(() => {
    const map = new Map<string, Movement[]>()
    const push = (entryId: string, m: Movement) => {
      if (!map.has(entryId)) map.set(entryId, [])
      map.get(entryId)!.push(m)
    }
    for (const cc of calls) {
      if (!cc.cap_table_entry) continue
      push(cc.cap_table_entry, {
        kind: "call",
        date: cc.called_at ?? cc.due_date ?? 0,
        amount: cc.amount ?? 0,
        call: cc,
      })
    }
    for (const p of payouts) {
      if (!p.cap_table_entry || !p.type) continue
      push(p.cap_table_entry, {
        kind: p.type,
        date: p.paid_at ?? p.declared_at ?? 0,
        amount: p.amount ?? 0,
        status: (p.status ?? "pending") as "pending" | "paid",
        payout: p,
      })
    }
    for (const t of transfers) {
      if (t.seller_cap_table_entry) {
        push(t.seller_cap_table_entry, {
          kind: "transfer_out",
          date: t.transferred_at ?? 0,
          shares: t.shares ?? 0,
          amount: t.amount ?? 0,
          navPerShare: t.nav_per_share ?? 0,
          counterpartyName: t.buyer_cap_table_entry ? nameByEntryId.get(t.buyer_cap_table_entry) ?? "—" : "—",
          status: (t.status ?? "pending") as "pending" | "executed" | "reversed",
          transfer: t,
        })
      }
      if (t.buyer_cap_table_entry) {
        push(t.buyer_cap_table_entry, {
          kind: "transfer_in",
          date: t.transferred_at ?? 0,
          shares: t.shares ?? 0,
          amount: t.amount ?? 0,
          navPerShare: t.nav_per_share ?? 0,
          counterpartyName: t.seller_cap_table_entry ? nameByEntryId.get(t.seller_cap_table_entry) ?? "—" : "—",
          status: (t.status ?? "pending") as "pending" | "executed" | "reversed",
          transfer: t,
        })
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.date - b.date)
    return map
  }, [calls, payouts, transfers, nameByEntryId])

  // Aggregate per-entry amounts. When a currency filter is active we keep values
  // native (no FX needed since all entries share the same currency). When viewing
  // "all", convert each entry's amount to the fund currency before summing.
  const sumInFundCcy = (m: Map<string, number>): number => {
    let total = 0
    for (const [entryId, amt] of m.entries()) {
      if (!amt) continue
      const ccy = entryCurrencyCode.get(entryId) ?? fundCode
      if (currencyFilter !== "all" && ccy !== currencyFilter) continue
      total += currencyFilter !== "all" ? amt : toFundCurrency(amt, ccy)
    }
    return total
  }
  // Currency code to use for displaying totals (filter currency, or fund code).
  const totalsCurrencyCode = currencyFilter !== "all" ? currencyFilter : fundCode
  const liveValueByEntryFx = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entries) m.set(e.id, liveValueByEntry.get(e.id) ?? 0)
    return m
  }, [entries, liveValueByEntry])
  const totalPaid = sumInFundCcy(paidByEntry)
  const totalDistributed = sumInFundCcy(distributedByEntry)
  const totalRedeemed = sumInFundCcy(redeemedByEntry)
  const totalDeployed = sumInFundCcy(deployedByEntry)

  // Total live value = sum of all per-entry live values, FX-converted to fund ccy.
  const totalLiveValue = sumInFundCcy(liveValueByEntryFx)
  const totalShares = groups.reduce((s, g) => s + g.totalShares, 0)

  if (loading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-40">
        <Spinner className="size-5" />
      </div>
    )
  }

  const isEmpty = groups.length === 0

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(() => {
            // Current NAV: weighted average across share classes (weighted by shares in each class)
            const currentNav = totalShares > 0 ? totalLiveValue / totalShares : (shareClasses[0]?.current_nav ?? null)
            const gl = totalDeployed > 0 ? totalLiveValue + totalDistributed + totalRedeemed - totalDeployed : null
            return [
              { label: "Investors", value: String(groups.length) },
              { label: "Paid", value: fmtCurrency(totalPaid, totalsCurrencyCode) },
              { label: "Deployed", value: fmtCurrency(totalDeployed, totalsCurrencyCode) },
              { label: "Shares", value: totalShares > 0 ? fmt(totalShares) : "—" },
              { label: "Current NAV", value: currentNav != null ? fmtCurrency(currentNav, totalsCurrencyCode) : "—" },
              { label: "Live value", value: fmtCurrency(totalLiveValue, totalsCurrencyCode), gl, glBase: totalDeployed },
            ]
          })().map((s) => (
            <div key={s.label} className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{s.value}</p>
              {"gl" in s && s.gl != null && (s as { glBase: number }).glBase > 0 && (() => {
                const glVal = s.gl as number
                const base = (s as { glBase: number }).glBase
                const pct = (glVal / base) * 100
                const color = glVal >= 0 ? "text-emerald-600" : "text-red-600"
                return (
                  <p className={`text-xs tabular-nums mt-0.5 ${color}`}>
                    {glVal >= 0 ? "+" : ""}{fmtCurrency(glVal, totalsCurrencyCode)} ({glVal >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                  </p>
                )
              })()}
            </div>
          ))}
        </div>

        {/* Share Classes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Share Classes</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAddShareClassOpen(true)}>
              <Plus className="size-3.5 mr-1.5" />
              Add share class
            </Button>
          </CardHeader>
          <CardContent>
            {shareClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No share classes defined yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {shareClasses.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => setEditShareClass(sc)}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="font-medium">{sc.name ?? "—"}</span>
                    {sc.current_nav != null && (
                      <span className="text-xs text-muted-foreground">{fmtCurrency(sc.current_nav, currencyCode)}/share</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cap Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Cap Table</CardTitle>
            <div className="flex items-center gap-2">
              {availableCurrencies.length > 1 && (
                <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                  <SelectTrigger size="sm" className="h-8 text-xs gap-1.5">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All currencies</SelectItem>
                    {availableCurrencies.map((code) => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" variant="outline" onClick={() => setAddInvestorOpen(true)}>
                <UserPlus className="size-3.5 mr-1.5" />
                Add investor
              </Button>
            </div>
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
                    <th className="text-right py-2 px-3 font-medium">Paid</th>
                    <th className="text-right py-2 px-3 font-medium">Deployed</th>
                    <th className="text-right py-2 px-3 font-medium">Shares</th>
                    <th className="text-right py-2 px-3 font-medium">Distributed</th>
                    <th className="text-right py-2 px-3 font-medium">Redeemed</th>
                    <th className="text-right py-2 px-3 font-medium">Live value</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>

                  {/* ── All investors grouped by shareholder ── */}
                  {groups.map((group) => {
                    const shKey = `sh:${group.shareholder.id}`
                    const shExpanded = expandedRows.has(shKey)
                    // Aggregate per-entry amounts in the fund's currency so multi-currency
                    // shareholders display correctly.
                    const sumEntries = (m: Map<string, number>) =>
                      group.entries.reduce((s, eg) => {
                        const v = m.get(eg.entry.id) ?? 0
                        const ccy = entryCurrencyCode.get(eg.entry.id) ?? fundCode
                        return s + toFundCurrency(v, ccy)
                      }, 0)
                    const groupPaid = sumEntries(paidByEntry)
                    const groupDeployed = sumEntries(deployedByEntry)
                    const groupDistributed = sumEntries(distributedByEntry)
                    const groupRedeemed = sumEntries(redeemedByEntry)
                    const groupLiveValue = sumEntries(liveValueByEntryFx)
                    const entryCount = group.entries.length

                    // Determine the shareholder's primary currency for display.
                    // If all entries share one currency, show that as the primary
                    // and fund currency as a sub-line (FX-converted).
                    const groupCurrencies = new Set(group.entries.map((eg) => entryCurrencyCode.get(eg.entry.id) ?? fundCode))
                    const groupPrimaryCcy = groupCurrencies.size === 1
                      ? Array.from(groupCurrencies)[0]
                      : fundCode
                    const showFx = groupPrimaryCcy !== fundCode
                    // Sum each map in the primary currency (no FX) when single-ccy.
                    const sumNative = (m: Map<string, number>) =>
                      group.entries.reduce((s, eg) => s + (m.get(eg.entry.id) ?? 0), 0)
                    const nativePaid = showFx ? sumNative(paidByEntry) : groupPaid
                    const nativeDeployed = showFx ? sumNative(deployedByEntry) : groupDeployed
                    const nativeDistributed = showFx ? sumNative(distributedByEntry) : groupDistributed
                    const nativeRedeemed = showFx ? sumNative(redeemedByEntry) : groupRedeemed
                    const nativeLiveValue = showFx ? sumNative(liveValueByEntryFx) : groupLiveValue

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
                            <button
                              className="text-left hover:underline underline-offset-2"
                              onClick={() => setInvestorSheet({ open: true, shareholder: group.shareholder })}
                            >
                              <div>{group.shareholder.name ?? "—"}</div>
                              {group.shareholder.email && (
                                <div className="text-xs font-normal text-muted-foreground">{group.shareholder.email}</div>
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{nativePaid > 0 ? fmtCurrency(nativePaid, groupPrimaryCcy) : "—"}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{nativeDeployed > 0 ? fmtCurrency(nativeDeployed, groupPrimaryCcy) : "—"}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{group.totalShares > 0 ? fmt(group.totalShares) : "—"}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-amber-600">{nativeDistributed > 0 ? `−${fmtCurrency(nativeDistributed, groupPrimaryCcy)}` : "—"}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-red-600">{nativeRedeemed > 0 ? `−${fmtCurrency(nativeRedeemed, groupPrimaryCcy)}` : "—"}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {nativeLiveValue > 0 ? (
                              <div>
                                <div>{fmtCurrency(nativeLiveValue, groupPrimaryCcy)}</div>
                                {showFx && <div className="text-[10px] text-muted-foreground">{fmtCurrency(groupLiveValue, fundCode)}</div>}
                                {groupDeployed > 0 && (() => {
                                  const gl = groupLiveValue + groupDistributed + groupRedeemed - groupDeployed
                                  const pct = (gl / groupDeployed) * 100
                                  const color = gl >= 0 ? "text-emerald-600" : "text-red-600"
                                  return (
                                    <div className={`text-[11px] ${color}`}>
                                      {gl >= 0 ? "+" : ""}{fmtCurrency(gl, fundCode)} ({gl >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                                    </div>
                                  )
                                })()}
                              </div>
                            ) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {(() => {
                              const isActive = group.totalShares > 0.0001
                              return (
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                                    isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                                  }`}
                                  title={`${entryCount} round${entryCount !== 1 ? "s" : ""}`}
                                >
                                  <span
                                    className={`inline-block size-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
                                  />
                                  {isActive ? "Active" : "Inactive"}
                                </span>
                              )
                            })()}
                          </td>
                        </tr>

                        {/* Entry rows (visible when shareholder expanded) */}
                        {shExpanded && group.entries.map((eg) => {
                          const entryKey = `entry:${eg.entry.id}`
                          const entryExpanded = expandedRows.has(entryKey)
                          const sc = shareClasses.find((s) => s.id === eg.entry.share_class)
                          const entryDeployed = deployedByEntry.get(eg.entry.id) ?? 0
                          const entryLiveValue = eg.liveValue
                          const entryPaid = paidByEntry.get(eg.entry.id) ?? 0
                          const entryDistributed = distributedByEntry.get(eg.entry.id) ?? 0
                          const entryRedeemed = redeemedByEntry.get(eg.entry.id) ?? 0

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
                                {(() => {
                                  const entryCcy = entryCurrencyCode.get(eg.entry.id) ?? fundCode
                                  const showFundFx = entryCcy !== fundCode
                                  return <>
                                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{entryPaid > 0 ? fmtCurrency(entryPaid, entryCcy) : "—"}</td>
                                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{entryDeployed > 0 ? fmtCurrency(entryDeployed, entryCcy) : "—"}</td>
                                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{eg.netShares > 0 ? fmt(eg.netShares) : "—"}</td>
                                    <td className="py-2 px-3 text-right tabular-nums text-amber-600/80">{entryDistributed > 0 ? `−${fmtCurrency(entryDistributed, entryCcy)}` : "—"}</td>
                                    <td className="py-2 px-3 text-right tabular-nums text-red-600/80">{entryRedeemed > 0 ? `−${fmtCurrency(entryRedeemed, entryCcy)}` : "—"}</td>
                                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                                      {entryLiveValue > 0 ? (
                                        <div>
                                          <div>{fmtCurrency(entryLiveValue, entryCcy)}</div>
                                          {showFundFx && (
                                            <div className="text-[11px] text-muted-foreground">{fmtCurrency(toFundCurrency(entryLiveValue, entryCcy), fundCode)}</div>
                                          )}
                                          {entryDeployed > 0 && (() => {
                                            const gl = entryLiveValue + entryDistributed + entryRedeemed - entryDeployed
                                            const pct = (gl / entryDeployed) * 100
                                            const color = gl >= 0 ? "text-emerald-600" : "text-red-600"
                                            return (
                                              <div className={`text-[11px] ${color}`}>
                                                {gl >= 0 ? "+" : ""}{fmtCurrency(gl, entryCcy)} ({gl >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                                              </div>
                                            )
                                          })()}
                                        </div>
                                      ) : "—"}
                                    </td>
                                  </>
                                })()}
                                <td className="py-2 px-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {eg.calls.length} call{eg.calls.length !== 1 ? "s" : ""}
                                    </span>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="size-6">
                                          <MoreHorizontal className="size-3.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="min-w-44">
                                        <DropdownMenuItem onClick={() => setEditEntryDialog({ open: true, entry: eg.entry })}>
                                          <Pencil className="size-3.5 mr-2" /> <span className="whitespace-nowrap">Edit entry</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setReinvestDialog({ open: true, shareholder: group.shareholder, entry: eg.entry })}>
                                          <RefreshCw className="size-3.5 mr-2" /> <span className="whitespace-nowrap">Reinvest</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          disabled={eg.netShares <= 0}
                                          onClick={() => setTransferDialog({ open: true, shareholder: group.shareholder, entry: eg.entry, netShares: eg.netShares })}
                                        >
                                          <ArrowRightLeft className="size-3.5 mr-2" /> <span className="whitespace-nowrap">Transfer shares</span>
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </td>
                              </tr>

                              {/* Movement rows (calls + distributions + redemptions + share transfers) */}
                              {entryExpanded && (movementsByEntry.get(eg.entry.id) ?? []).map((mv) => {
                                let rowKey: string
                                if (mv.kind === "call") rowKey = `call-${mv.call.id}`
                                else if (mv.kind === "transfer_out") rowKey = `transfer_out-${mv.transfer.id}`
                                else if (mv.kind === "transfer_in") rowKey = `transfer_in-${mv.transfer.id}`
                                else rowKey = `payout-${mv.payout.id}`

                                // Per-type values to drop into Paid / Deployed / Shares / Distributed / Redeemed columns.
                                let paidCell: React.ReactNode = ""
                                let deployedCell: React.ReactNode = ""
                                let sharesCell: React.ReactNode = ""
                                let distCell: React.ReactNode = ""
                                let redCell: React.ReactNode = ""
                                let labelBadge: React.ReactNode = null
                                let labelDate: React.ReactNode = null
                                let labelSubtext: React.ReactNode = null
                                let statusBadge: React.ReactNode = null
                                let actionsCell: React.ReactNode = null

                                if (mv.kind === "call") {
                                  const cc = mv.call
                                  const callSc = shareClasses.find((s) => s.id === (cc.share_class ?? eg.entry.share_class))
                                  // Prefer the historical NAV from the entry's original subscription mutation;
                                  // fall back to current class NAV (less accurate but better than nothing).
                                  const navForShares = originalNavByEntry.get(eg.entry.id) ?? callSc?.current_nav ?? null
                                  const sharesForCall = navForShares && cc.amount ? cc.amount / navForShares : null
                                  const isDeployed = cc.deployed_at != null
                                  const isPaid = cc.status === "paid" || isDeployed
                                  const canDelete = !isDeployed
                                  const statusLabel = isDeployed ? "Deployed" : cc.status === "paid" ? "Paid" : cc.status === "partial" ? "Partial" : "Pending"
                                  const statusClass = isDeployed ? "bg-emerald-100 text-emerald-800" : STATUS_BADGE[cc.status ?? "pending"]
                                  labelBadge = <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-blue-100 text-blue-700">Capital call</span>
                                  labelDate = cc.called_at ? fmtDate(cc.called_at) : "Pending issue"
                                  labelSubtext = callSc ? (
                                    <>{callSc.name}{callSc.current_nav != null && ` · ${fmtCurrency(callSc.current_nav, currencyCode)}/share`}</>
                                  ) : null
                                  // Capital call inherits its entry's currency.
                                  const callCcy = entryCurrencyCode.get(eg.entry.id) ?? fundCode
                                  paidCell = isPaid ? <span className="text-emerald-700">+{fmtCurrency(cc.amount, callCcy)}</span> : <span className="text-muted-foreground">{fmtCurrency(cc.amount, callCcy)}</span>
                                  deployedCell = isDeployed
                                    ? <span className="text-emerald-700">+{fmtCurrency(cc.amount, callCcy)}</span>
                                    : (cc.status === "paid"
                                      ? <CapitalCallReceive capitalCall={cc} entityUUID={entityUUID} currencyCode={callCcy} label="Deploy" onSuccess={load} />
                                      : "")
                                  sharesCell = sharesForCall != null ? <span className="text-muted-foreground">{fmt(sharesForCall)}</span> : ""
                                  statusBadge = <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ${statusClass}`}>{statusLabel}</span>
                                  actionsCell = isDeployed ? (
                                    <Lock className="size-3 text-muted-foreground/40" />
                                  ) : (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="size-6">
                                          <MoreHorizontal className="size-3.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setEditDialog({ open: true, call: cc, entryShareClass: eg.entry.share_class })}>
                                          <Pencil className="size-3.5 mr-2" /> Edit
                                        </DropdownMenuItem>
                                        {canDelete && (
                                          <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteCall(cc.id)}>
                                              <Trash2 className="size-3.5 mr-2" /> Delete
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )
                                } else if (mv.kind === "distribution" || mv.kind === "redemption") {
                                  const isDist = mv.kind === "distribution"
                                  const label = isDist ? "Distribution" : "Redemption"
                                  const badgeClass = isDist ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                  const statusClass = mv.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                  const statusLabel = mv.status === "paid" ? "Paid" : "Pending"
                                  labelBadge = <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}>{label}</span>
                                  labelDate = mv.date ? fmtDate(mv.date) : "—"
                                  if (!isDist && mv.payout.shares_redeemed != null) {
                                    labelSubtext = <>{fmt(mv.payout.shares_redeemed)} shares redeemed</>
                                  }
                                  if (isDist) {
                                    distCell = <span className="text-amber-600">−{fmtCurrency(mv.amount, currencyCode)}</span>
                                  } else {
                                    redCell = <span className="text-red-600">−{fmtCurrency(mv.amount, currencyCode)}</span>
                                    if (mv.payout.shares_redeemed != null) {
                                      sharesCell = <span className="text-muted-foreground">−{fmt(mv.payout.shares_redeemed)}</span>
                                    }
                                  }
                                  statusBadge = <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ${statusClass}`}>{statusLabel}</span>
                                } else {
                                  // transfer_out / transfer_in
                                  const isOut = mv.kind === "transfer_out"
                                  const label = isOut ? "Transfer out" : "Transfer in"
                                  const badgeClass = isOut ? "bg-slate-100 text-slate-700" : "bg-indigo-100 text-indigo-700"
                                  const statusClass = mv.status === "executed" ? "bg-emerald-100 text-emerald-800" : mv.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"
                                  const statusLabel = mv.status === "executed" ? "Executed" : mv.status === "pending" ? "Pending" : "Reversed"
                                  labelBadge = <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}>{label}</span>
                                  labelDate = mv.date ? fmtDate(mv.date) : "—"
                                  labelSubtext = (
                                    <>{isOut ? "→" : "←"} {mv.counterpartyName}{mv.navPerShare > 0 && ` · ${fmtCurrency(mv.navPerShare, currencyCode)}/share`}</>
                                  )
                                  if (isOut) {
                                    // Seller's stake (and the underlying deployed capital) leaves the position.
                                    redCell = <span className="text-red-600">−{fmtCurrency(mv.amount, currencyCode)}</span>
                                    if (mv.shares > 0) sharesCell = <span className="text-muted-foreground">−{fmt(mv.shares)}</span>
                                    if (mv.status === "executed") {
                                      deployedCell = <span className="text-red-600">−{fmtCurrency(mv.amount, currencyCode)}</span>
                                    }
                                  } else {
                                    // Buyer inherits already-deployed capital — no fund cash movement, so it's auto-deployed.
                                    paidCell = <span className="text-emerald-700">+{fmtCurrency(mv.amount, currencyCode)}</span>
                                    if (mv.shares > 0) sharesCell = <span className="text-muted-foreground">+{fmt(mv.shares)}</span>
                                    if (mv.status === "executed") {
                                      deployedCell = <span className="text-emerald-700">+{fmtCurrency(mv.amount, currencyCode)}</span>
                                    }
                                  }
                                  statusBadge = <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ${statusClass}`}>{statusLabel}</span>
                                  // Show "Execute now" only on the seller-side row to avoid duplicate buttons
                                  if (mv.status === "pending" && isOut) {
                                    const isExecuting = executingTransferId === mv.transfer.id
                                    actionsCell = (
                                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={isExecuting} onClick={() => executeTransfer(mv.transfer.id)}>
                                        {isExecuting ? "…" : "Execute now"}
                                      </Button>
                                    )
                                  }
                                }

                                return (
                                  <tr key={rowKey} className="bg-muted/20 border-b text-xs">
                                    <td colSpan={2} className="py-2 px-3 pl-14">
                                      <div className="font-medium text-foreground flex items-center gap-2">
                                        {labelBadge}
                                        {labelDate}
                                        {statusBadge}
                                      </div>
                                      {labelSubtext && (
                                        <div className="text-muted-foreground text-[11px] mt-0.5">{labelSubtext}</div>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">{paidCell}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">{deployedCell}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">{sharesCell}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">{distCell}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">{redCell}</td>
                                    <td className="py-2 px-3"></td>
                                    <td className="py-2 px-3 text-right">{actionsCell}</td>
                                  </tr>
                                )
                              })}

                              {entryExpanded && (movementsByEntry.get(eg.entry.id)?.length ?? 0) === 0 && (
                                <tr className="bg-muted/20 border-b">
                                  <td colSpan={9} className="py-2 px-3 pl-14 text-xs text-muted-foreground">
                                    No movements recorded for this round.
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}

                        {shExpanded && group.entries.length === 0 && (
                          <tr className="bg-muted/10 border-b">
                            <td colSpan={9} className="py-2 px-3 pl-8 text-xs text-muted-foreground">
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
                    <td className="py-2 px-3 text-right tabular-nums">{totalPaid > 0 ? fmtCurrency(totalPaid, totalsCurrencyCode) : "—"}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{totalDeployed > 0 ? fmtCurrency(totalDeployed, totalsCurrencyCode) : "—"}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{totalShares > 0 ? fmt(totalShares) : "—"}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-amber-600">{totalDistributed > 0 ? `−${fmtCurrency(totalDistributed, totalsCurrencyCode)}` : "—"}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-red-600">{totalRedeemed > 0 ? `−${fmtCurrency(totalRedeemed, totalsCurrencyCode)}` : "—"}</td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {totalLiveValue > 0 ? (
                        <div>
                          <div>{fmtCurrency(totalLiveValue, totalsCurrencyCode)}</div>
                          {totalDeployed > 0 && (() => {
                            const gl = totalLiveValue + totalDistributed + totalRedeemed - totalDeployed
                            const pct = (gl / totalDeployed) * 100
                            const color = gl >= 0 ? "text-emerald-600" : "text-red-600"
                            return (
                              <div className={`text-[11px] ${color}`}>
                                {gl >= 0 ? "+" : ""}{fmtCurrency(gl, totalsCurrencyCode)} ({gl >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                              </div>
                            )
                          })()}
                        </div>
                      ) : "—"}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>

      </div>

      <EditEntryDialog
        open={editEntryDialog.open}
        onClose={() => setEditEntryDialog({ open: false, entry: null })}
        entry={editEntryDialog.entry}
        shareClasses={shareClasses}
        currencyCode={currencyCode}
        onSaved={load}
      />

      <EditCapitalCallDialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, call: null, entryShareClass: null })}
        entityUUID={entityUUID}
        call={editDialog.call}
        entryShareClass={editDialog.entryShareClass}
        shareClasses={shareClasses}
        currencyCode={currencyCode}
        onSaved={load}
      />

      {reinvestDialog.shareholder && reinvestDialog.entry && (
        <ReinvestDialog
          open={reinvestDialog.open}
          onClose={() => setReinvestDialog({ open: false, shareholder: null, entry: null })}
          shareholder={reinvestDialog.shareholder}
          entry={reinvestDialog.entry}
          fundId={fundId}
          fundEntityUUID={entityUUID}
          shareClasses={shareClasses}
          currencyCode={currencyCode}
          onSuccess={load}
        />
      )}

      {transferDialog.shareholder && transferDialog.entry && (() => {
        const sellerEntryId = transferDialog.entry.id
        const recipients: RecipientOption[] = groups
          .flatMap((g) => g.entries.map((eg) => ({
            entryId: eg.entry.id,
            name: g.shareholder.name ?? "—",
            email: g.shareholder.email ?? null,
            netShares: eg.netShares,
          })))
          .filter((r) => r.entryId !== sellerEntryId && r.netShares >= 0)
        return (
          <ShareTransferDeclareDialog
            open={transferDialog.open}
            onClose={() => setTransferDialog({ open: false, shareholder: null, entry: null, netShares: 0 })}
            sellerShareholder={transferDialog.shareholder}
            sellerEntry={transferDialog.entry}
            sellerAvailableShares={transferDialog.netShares}
            recipients={recipients}
            fundEntityUUID={entityUUID}
            shareClasses={shareClasses}
            currencyCode={currencyCode}
            onSuccess={load}
          />
        )
      })()}

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
      <AddShareClassDialog
        open={addShareClassOpen}
        onClose={() => setAddShareClassOpen(false)}
        entityUUID={entityUUID}
        onSaved={load}
      />
      <EditShareClassDialog
        open={editShareClass !== null}
        onClose={() => setEditShareClass(null)}
        shareClass={editShareClass}
        entityUUID={entityUUID}
        onSaved={load}
      />

      <CapTableInvestorSheet
        shareholder={investorSheet.shareholder}
        fundEntityUUID={entityUUID}
        open={investorSheet.open}
        onOpenChange={(v) => setInvestorSheet((s) => ({ ...s, open: v }))}
        onUpdated={() => { void load() }}
      />
    </div>
  )
}
