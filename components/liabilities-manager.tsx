"use client"

import * as React from "react"
import { Trash2, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react"
import { notifyLiabilitiesUpdate } from "@/lib/ledger-events"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { DatePickerInput } from "@/components/date-input"
import { fetchEntityLiabilities, type Liability } from "@/lib/liabilities"
import { fetchEntityAssets, type EntityAsset } from "@/lib/entity-assets"
import { formatAmountWithCurrency } from "@/lib/entity-transactions"
import { LiabilitySheet } from "@/components/liability-sheet"
import { computeAll, type PaymentScheme } from "@/lib/amortization"

// ── Helpers ───────────────────────────────────────────────────────────────────

type PaidInfo = { count: number; lastDate: number | null }

type FundPayout = {
  id: string
  entity?: string | null
  fund_mutation?: string | null
  cap_table_entry?: string | null
  type?: "distribution" | "redemption" | null
  amount?: number | null
  nav_at_declaration?: number | null
  status?: "pending" | "paid" | null
  declared_at?: number | null
  paid_at?: number | null
  notes?: string | null
  _cap_table_entry?: {
    id: string
    _shareholder?: { id: string; name?: string | null; email?: string | null } | null
  } | null
}

function getOutstanding(l: Liability, paidCount: number): number {
  const p = l.loan_amount ?? 0
  if (paidCount === 0 || !l.interest_rate || !l.term_length || !l.frequency || !l.scheme) return p
  const periods = computeAll(p, l.interest_rate, l.frequency, l.term_length)[l.scheme as PaymentScheme]
  return periods[Math.min(paidCount, l.term_length) - 1]?.closing ?? p
}

function getNextPayment(l: Liability, paidCount: number): number | null {
  if (!l.loan_amount || !l.interest_rate || !l.term_length || !l.frequency || !l.scheme) return null
  if (paidCount >= l.term_length) return null
  const periods = computeAll(l.loan_amount, l.interest_rate, l.frequency, l.term_length)[l.scheme as PaymentScheme]
  return periods[paidCount]?.payment ?? null
}

function schemeBadgeColor(scheme: string | null | undefined): string {
  if (scheme === "linear") return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
  if (scheme === "annuity") return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
  if (scheme === "bullet") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
  return "bg-muted text-muted-foreground"
}

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(ms))
}

const PAYOUT_TYPE_LABEL: Record<string, string> = {
  distribution: "Distribution",
  redemption: "Redemption",
}

const PAYOUT_TYPE_COLOR: Record<string, string> = {
  distribution: "bg-blue-100 text-blue-700",
  redemption: "bg-red-100 text-red-700",
}

// ── Fund Fee type ────────────────────────────────────────────────────────────

type FundFee = {
  id: string
  entity?: string | null
  period?: string | null
  share_class?: string | null
  share_class_fee?: string | null
  cap_table_entry?: string | null
  amount?: number | null
  fee_per_share?: number | null
  shares_outstanding?: number | null
  status?: "accrued" | "paid" | null
  accrued_at?: number | null
  paid_at?: number | null
  notes?: string | null
  _cap_table_entry?: {
    id: string
    _shareholder?: { id: string; name?: string | null; email?: string | null } | null
  } | null
  _period?: { id: string; label?: string | null } | null
  _share_class_fee?: { id: string; type?: string | null; rate?: number | null; basis?: string | null } | null
}

// ── Accrued Fees Section ─────────────────────────────────────────────────────

function AccruedFeesSection({
  entityUUID,
  currencyCode,
  onTotalChange,
}: {
  entityUUID: string
  currencyCode: string | null
  onTotalChange: (total: number) => void
}) {
  const [fees, setFees] = React.useState<FundFee[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expanded, setExpanded] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = React.useState(false)
  const [bulkDate, setBulkDate] = React.useState<Date | undefined>(new Date())
  const [bulkSaving, setBulkSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/fund-fees?entity=${entityUUID}`, { cache: "no-store" })
      const data: FundFee[] = res.ok ? await res.json() : []
      const accrued = data.filter((f) => f.status === "accrued")
      setFees(accrued)
      // Select all by default whenever the list refreshes
      setSelectedIds(new Set(accrued.map((f) => f.id)))
      onTotalChange(accrued.reduce((s, f) => s + (f.amount ?? 0), 0))
    } catch {
      onTotalChange(0)
    } finally {
      setLoading(false)
    }
  }, [entityUUID]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { void load() }, [load])

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll(check: boolean) {
    setSelectedIds(check ? new Set(fees.map((f) => f.id)) : new Set())
  }

  async function bulkMarkPaid() {
    if (!bulkDate || selectedIds.size === 0) return
    setBulkSaving(true)
    try {
      const ts = bulkDate.getTime()
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/fund-fees/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "paid", paid_at: ts }),
          }),
        ),
      )
      setBulkOpen(false)
      await load()
    } finally {
      setBulkSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <p className="font-semibold text-sm">Accrued Fees</p>
        </div>
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (fees.length === 0) return null

  const total = fees.reduce((s, f) => s + (f.amount ?? 0), 0)

  const allSelected = fees.length > 0 && selectedIds.size === fees.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < fees.length
  const selectedTotal = fees.filter((f) => selectedIds.has(f.id)).reduce((s, f) => s + (f.amount ?? 0), 0)

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-orange-200 cursor-pointer hover:bg-orange-50/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          <p className="font-semibold text-sm">Accrued Fees</p>
          <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[11px] font-medium">
            {fees.length}
          </span>
        </div>
        <span className="text-sm font-semibold text-red-500 tabular-nums">
          {formatAmountWithCurrency(total, currencyCode)}
        </span>
      </button>
      {expanded && (
        <>
          <div className="flex items-center justify-between px-4 py-2 border-b border-orange-200 bg-orange-50/40">
            <p className="text-xs text-muted-foreground">
              {selectedIds.size} of {fees.length} selected · {formatAmountWithCurrency(selectedTotal, currencyCode)}
            </p>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={selectedIds.size === 0}
              onClick={() => { setBulkDate(new Date()); setBulkOpen(true) }}
            >
              <CheckCircle2 className="size-3.5" />
              Mark all selected as paid
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-orange-50/60">
                <th className="px-3 py-2 w-8">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(!!v)}
                    aria-label="Select all accrued fees"
                  />
                </th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Investor</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Period</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Shares</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fee/share</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {fees.map((f) => {
                const checked = selectedIds.has(f.id)
                return (
                  <tr key={f.id} className="hover:bg-orange-50/40">
                    <td className="px-3 py-3 text-center">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(f.id)}
                        aria-label="Select fee"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{f._cap_table_entry?._shareholder?.name ?? "—"}</div>
                      {f._cap_table_entry?._shareholder?.email && (
                        <div className="text-xs text-muted-foreground">{f._cap_table_entry._shareholder.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {f._period?.label ?? formatDate(f.accrued_at)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {f.shares_outstanding != null ? f.shares_outstanding.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {(() => {
                        const fps = f.fee_per_share ?? (f.amount != null && f.shares_outstanding ? f.amount / f.shares_outstanding : null)
                        return fps != null ? formatAmountWithCurrency(fps, currencyCode) : "—"
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-red-500">
                      {f.amount != null ? formatAmountWithCurrency(f.amount, currencyCode) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-orange-50/60 font-semibold">
                <td />
                <td colSpan={4} className="px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Total accrued</td>
                <td className="px-4 py-2 text-right tabular-nums text-red-500">
                  {formatAmountWithCurrency(total, currencyCode)}
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}

      <Dialog open={bulkOpen} onOpenChange={(v) => { if (!v && !bulkSaving) setBulkOpen(false) }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Mark fees as paid</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected</span>
                <span className="font-medium">{selectedIds.size} fee{selectedIds.size === 1 ? "" : "s"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium text-red-500">{formatAmountWithCurrency(selectedTotal, currencyCode)}</span>
              </div>
            </div>
            <DatePickerInput id="fee-bulk-date" label="Payment date" value={bulkDate} onChange={setBulkDate} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>Cancel</Button>
            <Button onClick={bulkMarkPaid} disabled={bulkSaving || !bulkDate || selectedIds.size === 0}>
              {bulkSaving ? "Processing…" : "Confirm paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Pending Payouts Section ───────────────────────────────────────────────────

function PendingPayoutsSection({
  entityUUID,
  currencyCode,
  onTotalChange,
}: {
  entityUUID: string
  currencyCode: string | null
  onTotalChange: (total: number) => void
}) {
  const [payouts, setPayouts] = React.useState<FundPayout[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expanded, setExpanded] = React.useState(false)
  const [deletingPayoutId, setDeletingPayoutId] = React.useState<string | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = React.useState(false)
  const [bulkDate, setBulkDate] = React.useState<Date | undefined>(new Date())
  const [bulkSaving, setBulkSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/fund-payouts?entity=${entityUUID}&status=pending`, { cache: "no-store" })
      const data: FundPayout[] = res.ok ? await res.json() : []
      setPayouts(data)
      setSelectedIds(new Set(data.map((p) => p.id)))
      onTotalChange(data.reduce((s, p) => s + (p.amount ?? 0), 0))
    } catch {
      onTotalChange(0)
    } finally {
      setLoading(false)
    }
  }, [entityUUID]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { void load() }, [load])

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll(check: boolean) {
    setSelectedIds(check ? new Set(payouts.map((p) => p.id)) : new Set())
  }

  async function bulkMarkPaid() {
    if (!bulkDate || selectedIds.size === 0) return
    setBulkSaving(true)
    try {
      const ts = bulkDate.getTime()
      // Process sequentially because each call creates ledger transactions and we
      // want predictable ordering / failure isolation.
      for (const id of Array.from(selectedIds)) {
        await fetch(`/api/fund-payout-pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, date: ts }),
        })
      }
      setBulkOpen(false)
      await load()
    } finally {
      setBulkSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <p className="font-semibold text-sm">Pending Payouts</p>
        </div>
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (payouts.length === 0) return null

  const total = payouts.reduce((s, p) => s + (p.amount ?? 0), 0)

  const allSelected = payouts.length > 0 && selectedIds.size === payouts.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < payouts.length
  const selectedTotal = payouts.filter((p) => selectedIds.has(p.id)).reduce((s, p) => s + (p.amount ?? 0), 0)

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-amber-200 cursor-pointer hover:bg-amber-50/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          <p className="font-semibold text-sm">Pending Payouts</p>
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-medium">
            {payouts.length}
          </span>
        </div>
        <span className="text-sm font-semibold text-red-500 tabular-nums">
          {formatAmountWithCurrency(total, currencyCode)}
        </span>
      </button>
      {expanded && (
        <>
          <div className="flex items-center justify-between px-4 py-2 border-b border-amber-200 bg-amber-50/40">
            <p className="text-xs text-muted-foreground">
              {selectedIds.size} of {payouts.length} selected · {formatAmountWithCurrency(selectedTotal, currencyCode)}
            </p>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={selectedIds.size === 0}
              onClick={() => { setBulkDate(new Date()); setBulkOpen(true) }}
            >
              <CheckCircle2 className="size-3.5" />
              Mark all selected as paid
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-amber-50/60">
                <th className="px-3 py-2 w-8">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(!!v)}
                    aria-label="Select all pending payouts"
                  />
                </th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Investor</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Type</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Declared</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {payouts.map((p) => {
                const typeKey = p.type ?? ""
                const checked = selectedIds.has(p.id)
                return (
                  <tr key={p.id} className="hover:bg-amber-50/40">
                    <td className="px-3 py-3 text-center">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(p.id)}
                        aria-label="Select payout"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p._cap_table_entry?._shareholder?.name ?? "—"}</div>
                      {p._cap_table_entry?._shareholder?.email && (
                        <div className="text-xs text-muted-foreground">{p._cap_table_entry._shareholder.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.type ? (
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PAYOUT_TYPE_COLOR[typeKey] ?? "bg-muted text-muted-foreground"}`}>
                          {PAYOUT_TYPE_LABEL[typeKey] ?? p.type}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(p.declared_at)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-red-500">
                      {p.amount != null ? formatAmountWithCurrency(p.amount, currencyCode) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {deletingPayoutId === p.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="destructive" className="h-6 px-2 text-xs"
                            onClick={async () => {
                              setDeletingPayoutId(p.id)
                              try {
                                if (p.fund_mutation) {
                                  await fetch(`/api/fund-mutations/${p.fund_mutation}`, { method: "DELETE" }).catch(() => {})
                                }
                                await fetch(`/api/fund-payouts/${p.id}`, { method: "DELETE" })
                                void load()
                              } finally {
                                setDeletingPayoutId(null)
                              }
                            }}
                          >Delete</Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setDeletingPayoutId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingPayoutId(p.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-amber-50/60 font-semibold">
                <td />
                <td colSpan={3} className="px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Total pending</td>
                <td className="px-4 py-2 text-right tabular-nums text-red-500">
                  {formatAmountWithCurrency(total, currencyCode)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </>
      )}

      <Dialog open={bulkOpen} onOpenChange={(v) => { if (!v && !bulkSaving) setBulkOpen(false) }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Mark payouts as paid</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected</span>
                <span className="font-medium">{selectedIds.size} payout{selectedIds.size === 1 ? "" : "s"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium text-red-500">{formatAmountWithCurrency(selectedTotal, currencyCode)}</span>
              </div>
            </div>
            <DatePickerInput id="payout-bulk-date" label="Payment date" value={bulkDate} onChange={setBulkDate} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>Cancel</Button>
            <Button onClick={bulkMarkPaid} disabled={bulkSaving || !bulkDate || selectedIds.size === 0}>
              {bulkSaving ? "Processing…" : "Confirm paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiabilitiesManager({
  entityUUID,
  initialLiabilityId,
  allowNewMoneyIn = false,
  showPayouts = false,
}: {
  entityUUID: string
  initialLiabilityId?: string
  allowNewMoneyIn?: boolean
  showPayouts?: boolean
}) {
  const [liabilities, setLiabilities] = React.useState<Liability[]>([])
  const [assetMap, setAssetMap] = React.useState<Map<string, EntityAsset>>(new Map())
  const [paidMap, setPaidMap] = React.useState<Map<string, PaidInfo>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)
  const [sheetLiability, setSheetLiability] = React.useState<Liability | null>(null)
  const [sheetDefaultTab, setSheetDefaultTab] = React.useState("overview")
  const [pendingPayoutsTotal, setPendingPayoutsTotal] = React.useState(0)
  const [accruedFeesTotal, setAccruedFeesTotal] = React.useState(0)
  const router = useRouter()
  const pathname = usePathname()

  function openSheet(l: Liability, tab = "overview") {
    setSheetDefaultTab(tab)
    setSheetLiability(l)
  }

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [libs, assets, entriesPayload] = await Promise.all([
        fetchEntityLiabilities(entityUUID),
        fetchEntityAssets(entityUUID),
        fetch(`/api/transaction-entries?entity=${entityUUID}`).then((r) => r.ok ? r.json() : { entries: [] }),
      ])
      libs.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
      setLiabilities(libs)
      setAssetMap(new Map(assets.map((a) => [a.id, a])))

      // Build paid periods map per liability
      const rawEntries = Array.isArray((entriesPayload as { entries?: unknown[] }).entries)
        ? (entriesPayload as { entries: Record<string, unknown>[] }).entries
        : []
      const pm = new Map<string, PaidInfo>()
      for (const e of rawEntries) {
        if (e.entry_type !== "principal" || e.direction !== "out" || e.object_type !== "liability") continue
        const objId = typeof e.object_id === "string" ? e.object_id : null
        if (!objId) continue
        const tx = e._transaction as Record<string, unknown> | undefined
        const txDate = tx && typeof tx.date === "number" ? tx.date : null
        const existing = pm.get(objId) ?? { count: 0, lastDate: null }
        pm.set(objId, {
          count: existing.count + 1,
          lastDate: txDate != null ? Math.max(existing.lastDate ?? 0, txDate) : existing.lastDate,
        })
      }
      setPaidMap(pm)
      if (initialLiabilityId) {
        const match = libs.find((l) => l.id === initialLiabilityId)
        if (match) setSheetLiability(match)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load liabilities.")
    } finally {
      setLoading(false)
    }
  }, [entityUUID, initialLiabilityId])

  React.useEffect(() => { void load() }, [load])

  async function deleteLiability(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/liabilities/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setLiabilities((prev) => prev.filter((l) => l.id !== id))
    } catch {
      // keep
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  // Loan liabilities outstanding
  const loanOutstanding = liabilities.reduce((s, l) => {
    const paid = paidMap.get(l.id)
    return s + getOutstanding(l, paid?.count ?? 0)
  }, 0)

  // Total = loans + pending payouts + accrued fees (when showPayouts enabled)
  const totalOutstanding = loanOutstanding + (showPayouts ? pendingPayoutsTotal + accruedFeesTotal : 0)

  // Cache combined total for sidebar / overview
  React.useEffect(() => {
    if (loading) return
    fetch(`/api/entity-stats/${entityUUID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liabilitiesValue: totalOutstanding }),
    }).catch(() => {})
    notifyLiabilitiesUpdate(entityUUID, totalOutstanding)
  }, [loading, entityUUID, totalOutstanding]) // eslint-disable-line react-hooks/exhaustive-deps

  const avgRate = liabilities.length > 0
    ? liabilities.reduce((s, l) => s + (l.interest_rate ?? 0), 0) / liabilities.filter((l) => l.interest_rate != null).length
    : 0

  // Primary currency from most common linked asset, falling back to first cash asset's currency
  const primaryCurrency = React.useMemo(() => {
    for (const l of liabilities) {
      if (l.asset) {
        const asset = assetMap.get(l.asset)
        if (asset?.currencyCode) return asset.currencyCode
      }
    }
    // Fallback: first asset with a currency code (covers funds with no liabilities but with fees)
    for (const [, asset] of assetMap) {
      if (asset.currencyCode) return asset.currencyCode
    }
    return null
  }, [liabilities, assetMap])

  return (
    <>
    <LiabilitySheet
      liability={sheetLiability}
      open={!!sheetLiability}
      onOpenChange={(v) => { if (!v) setSheetLiability(null) }}
      assetName={sheetLiability?.asset ? assetMap.get(sheetLiability.asset)?.name : null}
      defaultTab={sheetDefaultTab}
      allowNewMoneyIn={allowNewMoneyIn}
    />
    <div className="space-y-6">

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total liabilities</p>
          <p className="text-2xl font-semibold mt-1">{loading ? "—" : liabilities.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total outstanding</p>
          <p className="text-2xl font-semibold mt-1 text-red-500">
            {loading ? "—" : formatAmountWithCurrency(totalOutstanding, primaryCurrency)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Avg interest rate</p>
          <p className="text-2xl font-semibold mt-1">
            {loading ? "—" : liabilities.some((l) => l.interest_rate != null) ? `${avgRate.toFixed(2)}%` : "—"}
          </p>
        </div>
      </div>

      {/* Accrued fees — funds only */}
      {showPayouts && (
        <AccruedFeesSection
          entityUUID={entityUUID}
          currencyCode={primaryCurrency}
          onTotalChange={setAccruedFeesTotal}
        />
      )}

      {/* Pending payouts — funds only */}
      {showPayouts && (
        <PendingPayoutsSection
          entityUUID={entityUUID}
          currencyCode={primaryCurrency}
          onTotalChange={setPendingPayoutsTotal}
        />
      )}

      {/* Liabilities list */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">All Liabilities</p>
        </div>

        {loading && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
        )}

        {!loading && error && (
          <div className="px-4 py-6 text-sm text-destructive">{error}</div>
        )}

        {!loading && !error && liabilities.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No liabilities recorded yet.</div>
        )}

        {!loading && liabilities.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Name</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Asset</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Scheme</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Outstanding</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Last payment</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Next payment</th>
                <th className="px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Manage</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {liabilities.map((l) => {
                const asset = l.asset ? assetMap.get(l.asset) : undefined
                const isConfirming = confirmDeleteId === l.id
                const isDeleting = deletingId === l.id

                const paid = paidMap.get(l.id)
                const paidCount = paid?.count ?? 0
                const outstanding = getOutstanding(l, paidCount)
                const nextPayment = getNextPayment(l, paidCount)

                return (
                  <tr key={l.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.name || "—"}</div>
                      {l.reference && (
                        <div className="text-xs text-muted-foreground">{l.reference}</div>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 cursor-pointer hover:underline"
                      onClick={() => {
                        if (!asset) return
                        const base = pathname.split("/").slice(0, -1).join("/")
                        router.push(`${base}/assets?asset=${asset.id}`)
                      }}
                    >
                      {asset ? (
                        <>
                          <div className="font-medium">{asset.name || "—"}</div>
                          {asset.className && (
                            <div className="text-xs text-muted-foreground">{asset.className}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {l.scheme ? (
                        <button
                          type="button"
                          onClick={() => openSheet(l, "scheme")}
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide cursor-pointer hover:opacity-80 transition-opacity ${schemeBadgeColor(l.scheme)}`}
                        >
                          {l.scheme}
                        </button>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-red-500">
                      {l.loan_amount != null
                        ? formatAmountWithCurrency(outstanding, asset?.currencyCode ?? null)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {paid?.lastDate ? formatDate(paid.lastDate) : "—"}
                      {paidCount > 0 && (
                        <div className="text-xs text-muted-foreground">{paidCount} paid</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {nextPayment != null
                        ? formatAmountWithCurrency(nextPayment, asset?.currencyCode ?? null)
                        : paidCount > 0 && l.term_length != null && paidCount >= l.term_length
                          ? <span className="text-xs text-green-600 font-medium">Paid off</span>
                          : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => openSheet(l)}
                      >
                        Manage
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 px-2 text-xs"
                            disabled={isDeleting}
                            onClick={() => deleteLiability(l.id)}
                          >
                            {isDeleting ? "…" : "Delete"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() => setConfirmDeleteId(l.id)}
                          title="Delete liability"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td colSpan={3} className="px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Total outstanding</td>
                <td className="px-4 py-2 text-right tabular-nums text-red-500">
                  {formatAmountWithCurrency(loanOutstanding, primaryCurrency)}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
    </>
  )
}
