"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { DatePickerInput } from "@/components/date-input"
import { fetchShareClasses, fetchCapTableEntries, type ShareClass, type CapTableEntry } from "@/lib/cap-table"
import { Lock, Plus, ChevronDown, ChevronUp } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type FundMutation = {
  id: string
  period?: string | null
  mutation_group?: string | null
  cap_table_entry?: string | null
  type?: "subscription" | "redemption" | "distribution" | null
  mutation_at?: number | null
  nav_per_share?: number | null
  amount_invested?: number | null
  fee_amount?: number | null
  amount_for_shares?: number | null
  shares_issued?: number | null
  shares_redeemed?: number | null
  amount_returned?: number | null
  amount_distributed?: number | null
  notes?: string | null
  _cap_table_entry?: {
    id: string
    _shareholder?: { id: string; name?: string | null; email?: string | null } | null
  } | null
}

type MutationGroup = {
  id: string
  entity?: string | null
  status?: "draft" | "confirmed" | null
  label?: string | null
  date?: number | null
  notes?: string | null
  created_at?: number | null
  _fund_mutation?: FundMutation[] | null
}

type FundPeriod = {
  id: string
  entity?: string | null
  status?: "open" | "closed" | null
  label?: string | null
  opened_at?: number | null
  closed_at?: number | null
  nav_start?: number | null
  nav_end?: number | null
  total_shares_start?: number | null
  total_shares_end?: number | null
  total_aum_start?: number | null
  total_aum_end?: number | null       // row 14: assets − liabilities (balance from financials)
  total_invested_assets?: number | null
  total_debt?: number | null
  nav_gross_end?: number | null
  yield_net?: number | null
  yield_gross?: number | null
  management_fee_per_share?: number | null
  management_fee_total?: number | null
  pnl_costs?: number | null           // costs carried from PREVIOUS period
  notes?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: decimals }).format(n)
}

function fmtCcy(n: number | null | undefined, code = "EUR") {
  if (n == null) return "—"
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(n)
  } catch { return String(n) }
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—"
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return "—"
  return `${(n * 100).toFixed(2)}%`
}

const TYPE_LABELS: Record<string, string> = {
  subscription: "Subscription",
  redemption: "Redemption",
  distribution: "Distribution",
}

const TYPE_COLORS: Record<string, string> = {
  subscription: "bg-emerald-100 text-emerald-700",
  redemption: "bg-red-100 text-red-700",
  distribution: "bg-blue-100 text-blue-700",
}

// ─── Mutations Mini Table ─────────────────────────────────────────────────────

function MutationRows({ mutations, currencyCode }: { mutations: FundMutation[]; currencyCode: string }) {
  if (mutations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">No mutations for this period.</p>
    )
  }
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/30 border-b">
        <tr>
          <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Investor</th>
          <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Type</th>
          <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Date</th>
          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">NAV/share</th>
          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Amount</th>
          <th className="text-right py-2 px-4 text-xs font-medium text-muted-foreground">Shares</th>
        </tr>
      </thead>
      <tbody>
        {mutations.map((m) => {
          const investor = m._cap_table_entry?._shareholder
          const amount =
            m.type === "subscription" ? m.amount_for_shares :
            m.type === "redemption" ? m.amount_returned :
            m.amount_distributed
          const shares =
            m.type === "subscription" ? m.shares_issued :
            m.type === "redemption" ? -(m.shares_redeemed ?? 0) :
            null
          return (
            <tr key={m.id} className="border-b last:border-0">
              <td className="py-2 px-4">
                <div className="font-medium">{investor?.name ?? "—"}</div>
                {investor?.email && <div className="text-xs text-muted-foreground">{investor.email}</div>}
              </td>
              <td className="py-2 px-3">
                {m.type && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[m.type] ?? ""}`}>
                    {TYPE_LABELS[m.type]}
                  </span>
                )}
              </td>
              <td className="py-2 px-3 text-muted-foreground">{fmtDate(m.mutation_at)}</td>
              <td className="py-2 px-3 text-right tabular-nums">{fmtCcy(m.nav_per_share, currencyCode)}</td>
              <td className="py-2 px-3 text-right tabular-nums font-medium">{fmtCcy(amount, currencyCode)}</td>
              <td className="py-2 px-4 text-right tabular-nums">
                {shares != null ? (
                  <span className={shares < 0 ? "text-red-600" : ""}>{fmt(Math.abs(shares), 4)}</span>
                ) : "—"}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Add Mutation Dialog ──────────────────────────────────────────────────────

function AddMutationDialog({
  open,
  onClose,
  entityUUID,
  groupId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  entityUUID: string
  groupId: string
  onSuccess: () => void
}) {
  const [entries, setEntries] = React.useState<CapTableEntry[]>([])
  const [entryId, setEntryId] = React.useState("")
  const [type, setType] = React.useState<"subscription" | "redemption" | "distribution">("subscription")
  const [navPerShare, setNavPerShare] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [shares, setShares] = React.useState("")
  const [mutationAt, setMutationAt] = React.useState<Date | undefined>(new Date())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) fetchCapTableEntries(entityUUID).then(setEntries)
  }, [open, entityUUID])

  React.useEffect(() => {
    if (type === "subscription" && amount && navPerShare && Number(navPerShare) > 0) {
      setShares((Number(amount) / Number(navPerShare)).toFixed(4))
    }
  }, [amount, navPerShare, type])

  async function handleSave() {
    if (!entryId) { setError("Select an investor."); return }
    if (!navPerShare || Number(navPerShare) <= 0) { setError("NAV per share is required."); return }
    if (!amount || Number(amount) <= 0) { setError("Amount is required."); return }
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        entity: entityUUID,
        mutation_group: groupId,
        cap_table_entry: entryId,
        type,
        nav_per_share: Number(navPerShare),
        mutation_at: mutationAt ? mutationAt.getTime() : Date.now(),
      }
      if (type === "subscription") {
        body.amount_for_shares = Number(amount)
        body.shares_issued = shares ? Number(shares) : Number(amount) / Number(navPerShare)
      } else if (type === "redemption") {
        body.amount_returned = Number(amount)
        if (shares) body.shares_redeemed = Number(shares)
      } else {
        body.amount_distributed = Number(amount)
      }
      const res = await fetch("/api/fund-mutations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed to add mutation")
      setEntryId(""); setAmount(""); setShares("")
      onSuccess()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const amountLabel =
    type === "subscription" ? "Amount for shares" :
    type === "redemption" ? "Amount returned" :
    "Amount distributed"

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add mutation</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <Field>
            <FieldLabel htmlFor="mut-investor">Investor</FieldLabel>
            <select
              id="mut-investor"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={entryId}
              onChange={(e) => setEntryId(e.target.value)}
            >
              <option value="">Select investor…</option>
              {entries.map((e) => (
                <option key={e.id} value={e.id}>{e._shareholder?.name ?? e.id}</option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="mut-type">Type</FieldLabel>
            <select
              id="mut-type"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="subscription">Subscription</option>
              <option value="redemption">Redemption</option>
              <option value="distribution">Distribution</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="mut-nav">NAV per share</FieldLabel>
            <Input id="mut-nav" type="number" min="0" step="0.0001" placeholder="0.0000" value={navPerShare} onChange={(e) => setNavPerShare(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="mut-amount">{amountLabel}</FieldLabel>
            <Input id="mut-amount" type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          {type !== "distribution" && (
            <Field>
              <FieldLabel htmlFor="mut-shares">{type === "subscription" ? "Shares issued" : "Shares redeemed"}</FieldLabel>
              <Input id="mut-shares" type="number" min="0" step="0.0001" placeholder="auto-computed" value={shares} onChange={(e) => setShares(e.target.value)} />
            </Field>
          )}
          <DatePickerInput id="mut-date" label="Date" value={mutationAt} onChange={setMutationAt} />
          {error && <FieldError>{error}</FieldError>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Spinner className="size-4 mr-2" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Confirm Group → Open Period ──────────────────────────────────────────────

function ConfirmGroupDialog({
  open,
  onClose,
  entityUUID,
  group,
  previousPeriod,
  shareClasses,
  currencyCode,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  entityUUID: string
  group: MutationGroup
  previousPeriod: FundPeriod | null
  shareClasses: ShareClass[]
  currencyCode: string
  onSuccess: () => void
}) {
  const mutations = group._fund_mutation ?? []
  const subscriptions = mutations.filter((m) => m.type === "subscription")
  const navStart = subscriptions[0]?.nav_per_share ?? null
  const totalAumStart = subscriptions.reduce((s, m) => s + (m.amount_for_shares ?? 0), 0)
  const totalSharesStart = previousPeriod?.total_shares_end ?? 0
  const newSharesIssued = subscriptions.reduce((s, m) => s + (m.shares_issued ?? 0), 0)

  const [label, setLabel] = React.useState(group.label ?? "")
  const [openedAt, setOpenedAt] = React.useState<Date | undefined>(
    group.date ? new Date(group.date) : new Date()
  )
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleConfirm() {
    if (mutations.length === 0) { setError("Group has no mutations."); return }
    setSaving(true)
    setError(null)
    try {
      const periodRes = await fetch("/api/fund-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: entityUUID,
          status: "open",
          label: label || null,
          opened_at: openedAt ? openedAt.getTime() : Date.now(),
          ...(navStart != null ? { nav_start: navStart } : {}),
          total_shares_start: totalSharesStart,
          ...(totalAumStart > 0 ? { total_aum_start: totalAumStart } : {}),
        }),
      })
      if (!periodRes.ok) throw new Error("Failed to create period")
      const period = (await periodRes.json()) as { id: string }

      await Promise.all(
        mutations.map((m) =>
          fetch(`/api/fund-mutations/${m.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ period: period.id }),
          })
        )
      )

      if (navStart != null) {
        await Promise.all(
          shareClasses.map((sc) =>
            fetch(`/api/share-classes/${sc.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ current_nav: navStart }),
            })
          )
        )
      }

      await fetch(`/api/fund-mutation-groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      })

      onSuccess()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open period from group</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Creates a new open period and links {mutations.length} mutation{mutations.length !== 1 ? "s" : ""} to it.
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1">
          <div className="rounded-lg border p-3 bg-muted/30 text-sm flex flex-col gap-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">NAV start</span>
              <span className="font-medium">{fmtCcy(navStart, currencyCode)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total AUM in</span>
              <span className="font-medium">{fmtCcy(totalAumStart, currencyCode)}</span>
            </div>
            {totalSharesStart > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shares carried forward</span>
                <span className="font-medium">{fmt(totalSharesStart, 4)}</span>
              </div>
            )}
            {newSharesIssued > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">New shares to be issued</span>
                <span className="font-medium text-emerald-600">+{fmt(newSharesIssued, 4)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1.5 mt-0.5">
              <span className="text-muted-foreground">Shares at period start</span>
              <span className="font-medium">{fmt(totalSharesStart, 4)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="conf-label">Period label</FieldLabel>
              <Input id="conf-label" placeholder="e.g. Period 1" value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <DatePickerInput id="conf-opened-at" label="Opening date" value={openedAt} onChange={setOpenedAt} />
          </div>
          {error && <FieldError>{error}</FieldError>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={saving || mutations.length === 0}>
            {saving ? <Spinner className="size-4 mr-2" /> : <Lock className="size-4 mr-2" />}
            Open period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Period close date suggestion ────────────────────────────────────────────

function suggestedCloseDate(openedAt: number, frequency: string): Date {
  const d = new Date(openedAt)
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate()
  let nextStart: Date
  switch (frequency) {
    case "daily":       nextStart = new Date(y, m, day + 1); break
    case "weekly":      nextStart = new Date(y, m, day + 7); break
    case "monthly":     nextStart = new Date(y, m + 1, day); break
    case "quarterly":   nextStart = new Date(y, m + 3, day); break
    case "bi-annually": nextStart = new Date(y, m + 6, day); break
    case "annually":    nextStart = new Date(y + 1, m, day); break
    default:            nextStart = new Date(y, m + 3, day)
  }
  // Close date = day before next period start
  return new Date(nextStart.getTime() - 24 * 60 * 60 * 1000)
}

// ─── Open Period Snapshot ─────────────────────────────────────────────────────

function SnapRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 border-b last:border-0 ${highlight ? "font-semibold" : ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs tabular-nums ${highlight ? "text-foreground" : "text-foreground/80"}`}>{value}</span>
    </div>
  )
}

type EntityStats = { assetsValue: number; liabilitiesValue: number } | null

function OpenPeriodSnapshot({
  period,
  mutations,
  currencyCode,
  entityUUID,
  shareClasses,
  previousPeriod,
  periodFrequency,
  onRefresh,
}: {
  period: FundPeriod
  mutations: FundMutation[]
  currencyCode: string
  entityUUID: string
  shareClasses: ShareClass[]
  previousPeriod: FundPeriod | null
  periodFrequency?: string | null
  onRefresh: () => void
}) {
  const [stats, setStats] = React.useState<EntityStats>(null)
  const [statsLoading, setStatsLoading] = React.useState(true)
  const [closeOpen, setCloseOpen] = React.useState(false)

  const suggestedClose = period.opened_at && periodFrequency
    ? suggestedCloseDate(period.opened_at, periodFrequency)
    : null

  React.useEffect(() => {
    setStatsLoading(true)
    fetch(`/api/entity-stats/${entityUUID}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => { setStats(d); setStatsLoading(false) })
  }, [entityUUID])

  // Step A: Mutations in this period
  const subscriptions = mutations.filter((m) => m.type === "subscription")
  const redemptions = mutations.filter((m) => m.type === "redemption")
  const distributions = mutations.filter((m) => m.type === "distribution")
  const totalSubsIn = subscriptions.reduce((s, m) => s + (m.amount_for_shares ?? 0), 0)
  const totalRedOut = redemptions.reduce((s, m) => s + (m.amount_returned ?? 0), 0)
  const totalDist = distributions.reduce((s, m) => s + (m.amount_distributed ?? 0), 0)
  const totalSharesIssued = subscriptions.reduce((s, m) => s + (m.shares_issued ?? 0), 0)
  const totalSharesRedeemed = redemptions.reduce((s, m) => s + (m.shares_redeemed ?? 0), 0)
  const netMutationFlow = totalSubsIn - totalRedOut - totalDist

  // Step B: Portfolio value from entity stats
  const assetsValue = stats?.assetsValue ?? null
  const liabilitiesValue = stats?.liabilitiesValue ?? null
  const grossAum = assetsValue != null && liabilitiesValue != null
    ? assetsValue - liabilitiesValue
    : null

  // Derive starting shares from previous period's end (ignores any wrong stored value)
  const sharesAtStart = previousPeriod?.total_shares_end ?? 0
  const currentShares = sharesAtStart + totalSharesIssued - totalSharesRedeemed
  const lastNavPerShare = subscriptions[0]?.nav_per_share ?? period.nav_start ?? null

  // Step C: Management fee applied at close
  const periodsPerYear: Record<string, number> = {
    daily: 365, weekly: 52, monthly: 12, quarterly: 4, "bi-annually": 2, annually: 1,
  }
  const periodDivisor = periodFrequency ? (periodsPerYear[periodFrequency] ?? 1) : 1

  const mgmtFees = shareClasses.flatMap((sc) =>
    (sc._share_class_fee ?? []).filter((f) => f.type === "management")
  )
  const mgmtFeeTotal = grossAum != null && mgmtFees.length > 0
    ? mgmtFees.reduce((sum, f) => {
        if (f.basis === "fixed" && f.fixed_amount != null) return sum + f.fixed_amount
        if (f.basis === "nav" && f.rate != null) {
          const effectiveRate = f.rate_is_annual ? f.rate / periodDivisor : f.rate
          return sum + (effectiveRate / 100) * grossAum
        }
        return sum
      }, 0)
    : null
  const mgmtFeePerShare = mgmtFeeTotal != null && currentShares > 0 ? mgmtFeeTotal / currentShares : null
  // Step C tentative net (using calculated fee preview)
  const tentativeNetAum = grossAum != null ? grossAum - (mgmtFeeTotal ?? 0) : null
  const grossNavPerShare = grossAum != null && currentShares > 0 ? grossAum / currentShares : null
  const netNavPerShare = tentativeNetAum != null && currentShares > 0 ? tentativeNetAum / currentShares : null
  const grossYield = grossNavPerShare != null && lastNavPerShare != null && lastNavPerShare > 0
    ? (grossNavPerShare - lastNavPerShare) / lastNavPerShare : null
  const netYield = netNavPerShare != null && lastNavPerShare != null && lastNavPerShare > 0
    ? (netNavPerShare - lastNavPerShare) / lastNavPerShare : null
  const mgmtFeeRate = mgmtFees.length > 0
    ? mgmtFees.filter((f) => f.rate != null).map((f) => {
        const effective = f.rate_is_annual ? (f.rate! / periodDivisor) : f.rate!
        return f.rate_is_annual
          ? `${f.rate}% p.a. → ${effective.toFixed(4).replace(/\.?0+$/, "")}% this period`
          : `${f.rate}%`
      }).join(", ")
    : null

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-200 bg-emerald-50">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{period.label ?? `Period — ${fmtDate(period.opened_at)}`}</span>
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium">Open</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Opened {fmtDate(period.opened_at)}
            {suggestedClose && (
              <> · Suggested close: <span className="font-medium text-foreground">{fmtDate(suggestedClose.getTime())}</span></>
            )}
            {" "}· Tentative snapshot
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
          <Lock className="size-3.5 mr-1.5" />
          Close period
        </Button>
      </div>

      {/* Snapshot grid — 3 equal-height columns, 5 rows each */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x sm:[&>div]:flex sm:[&>div]:flex-col">
        {/* Step A: Mutations — 5 rows */}
        <div className="p-4">
          <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase mb-2">Step A — Mutations</p>
          <div className="divide-y flex-1">
            <SnapRow label="NAV/share at open" value={fmtCcy(period.nav_start, currencyCode)} />
            <SnapRow
              label={`Subscriptions (${subscriptions.length})`}
              value={totalSubsIn > 0 ? <span className="text-emerald-600">+{fmtCcy(totalSubsIn, currencyCode)}</span> : "—"}
            />
            <SnapRow
              label="Redemptions / distributions"
              value={totalRedOut > 0 || totalDist > 0
                ? <span className="text-red-600">−{fmtCcy(totalRedOut + totalDist, currencyCode)}</span>
                : <span className="text-muted-foreground">—</span>}
            />
            <SnapRow label="Shares at period start" value={fmt(sharesAtStart, 4)} />
            <SnapRow label="Current shares outstanding" value={fmt(currentShares, 4)} highlight />
          </div>
        </div>

        {/* Step B: Portfolio — 5 rows */}
        <div className="p-4">
          <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase mb-2">Step B — Portfolio Value</p>
          {statsLoading ? (
            <p className="text-xs text-muted-foreground">Loading live data…</p>
          ) : (
            <div className="divide-y flex-1">
              <SnapRow label="Total invested assets" value={assetsValue != null ? fmtCcy(assetsValue, currencyCode) : "—"} />
              <SnapRow
                label="Total debt / liabilities"
                value={liabilitiesValue != null ? <span className="text-red-600">−{fmtCcy(liabilitiesValue, currencyCode)}</span> : "—"}
              />
              <SnapRow label="Gross AUM" value={grossAum != null ? fmtCcy(grossAum, currencyCode) : "—"} />
              <SnapRow
                label="Costs & fees"
                value={period.pnl_costs != null && period.pnl_costs > 0
                  ? <span className="text-red-600">−{fmtCcy(period.pnl_costs, currencyCode)}</span>
                  : <span className="text-muted-foreground">€0 — calculated at close</span>}
              />
              <SnapRow
                label="Net AUM"
                value={grossAum != null ? fmtCcy(grossAum - (period.pnl_costs ?? 0), currencyCode) : "—"}
                highlight
              />
            </div>
          )}
        </div>

        {/* Step C: NAV — 5 rows */}
        <div className="p-4">
          <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase mb-2">Step C — Net NAV</p>
          <div className="divide-y flex-1">
            <SnapRow
              label="Gross NAV/share"
              value={
                <span className="flex items-center gap-2">
                  <span>{grossNavPerShare != null ? fmtCcy(grossNavPerShare, currencyCode) : statsLoading ? "Loading…" : "—"}</span>
                  {grossYield != null && (
                    <span className={`text-[10px] ${grossYield >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {grossYield >= 0 ? "+" : ""}{fmtPct(grossYield)}
                    </span>
                  )}
                </span>
              }
            />
            <SnapRow
              label={`Management fee/share${mgmtFeeRate ? ` (${mgmtFeeRate})` : ""}`}
              value={mgmtFeePerShare != null
                ? <span className="text-red-600">−{fmtCcy(mgmtFeePerShare, currencyCode)}</span>
                : <span className="text-muted-foreground">—</span>}
            />
            <SnapRow
              label="Management fee total"
              value={mgmtFeeTotal != null
                ? <span className="text-red-600">−{fmtCcy(mgmtFeeTotal, currencyCode)}</span>
                : <span className="text-muted-foreground">—</span>}
            />
            <SnapRow
              label="Net NAV/share"
              value={
                <span className="flex items-center gap-2">
                  <span>{netNavPerShare != null ? fmtCcy(netNavPerShare, currencyCode) : statsLoading ? "Loading…" : "—"}</span>
                  {netYield != null && (
                    <span className={`text-[10px] ${netYield >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {netYield >= 0 ? "+" : ""}{fmtPct(netYield)}
                    </span>
                  )}
                </span>
              }
              highlight
            />
            <SnapRow label="Total AUM" value={tentativeNetAum != null ? fmtCcy(tentativeNetAum, currencyCode) : "—"} />
          </div>
        </div>
      </div>

      <ClosePeriodDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        period={period}
        shareClasses={shareClasses}
        currencyCode={currencyCode}
        entityUUID={entityUUID}
        suggestedClose={suggestedClose}
        tentative={{
          grossNavPerShare: grossNavPerShare ?? undefined,
          grossYield: grossYield ?? undefined,
          mgmtFeePerShare: mgmtFeePerShare ?? undefined,
          mgmtFeeTotal: mgmtFeeTotal ?? undefined,
          netNavPerShare: netNavPerShare ?? undefined,
          netYield: netYield ?? undefined,
          totalShares: currentShares,
          totalAum: tentativeNetAum ?? undefined,
        }}
        onSuccess={() => { setCloseOpen(false); onRefresh() }}
      />
    </div>
  )
}

// ─── Mutation Group Card (draft) ──────────────────────────────────────────────

function MutationGroupCard({
  group,
  entityUUID,
  previousPeriod,
  shareClasses,
  currencyCode,
  onRefresh,
}: {
  group: MutationGroup
  entityUUID: string
  previousPeriod: FundPeriod | null
  shareClasses: ShareClass[]
  currencyCode: string
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = React.useState(true)
  const [addOpen, setAddOpen] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const mutations = group._fund_mutation ?? []
  const subscriptions = mutations.filter((m) => m.type === "subscription")
  const redemptions = mutations.filter((m) => m.type === "redemption")
  const distributions = mutations.filter((m) => m.type === "distribution")
  const totalAum = subscriptions.reduce((s, m) => s + (m.amount_for_shares ?? 0), 0)
  const totalShares = subscriptions.reduce((s, m) => s + (m.shares_issued ?? 0), 0)
  const navPerShare = subscriptions[0]?.nav_per_share ?? null

  const typeSummary = [
    subscriptions.length > 0 ? `${subscriptions.length} subscription${subscriptions.length > 1 ? "s" : ""}` : null,
    redemptions.length > 0 ? `${redemptions.length} redemption${redemptions.length > 1 ? "s" : ""}` : null,
    distributions.length > 0 ? `${distributions.length} distribution${distributions.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ")

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          <span className="font-medium text-sm">{group.label ?? "Unnamed group"}</span>
          {group.date && <span className="text-xs text-muted-foreground">{fmtDate(group.date)}</span>}
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-medium">
            Draft
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{typeSummary || "No mutations"}</span>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5 mr-1" />
            Add
          </Button>
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={mutations.length === 0}>
            <Lock className="size-3.5 mr-1" />
            Open period
          </Button>
        </div>
      </div>

      {expanded && (
        mutations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No mutations yet — add subscriptions, redemptions, or distributions.
          </p>
        ) : (
          <>
            <MutationRows mutations={mutations} currencyCode={currencyCode} />
            <div className="flex items-center gap-6 px-4 py-2.5 bg-muted/20 border-t text-xs text-muted-foreground">
              {navPerShare != null && (
                <span>NAV/share: <span className="font-medium text-foreground">{fmtCcy(navPerShare, currencyCode)}</span></span>
              )}
              {totalAum > 0 && (
                <span>Total in: <span className="font-medium text-foreground">{fmtCcy(totalAum, currencyCode)}</span></span>
              )}
              {totalShares > 0 && (
                <span>Shares: <span className="font-medium text-foreground">{fmt(totalShares, 4)}</span></span>
              )}
            </div>
          </>
        )
      )}

      <AddMutationDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        entityUUID={entityUUID}
        groupId={group.id}
        onSuccess={onRefresh}
      />
      <ConfirmGroupDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        entityUUID={entityUUID}
        group={group}
        previousPeriod={previousPeriod}
        shareClasses={shareClasses}
        currencyCode={currencyCode}
        onSuccess={onRefresh}
      />
    </div>
  )
}

// ─── Close Period Dialog ──────────────────────────────────────────────────────

function ClosePeriodDialog({
  open,
  onClose,
  period,
  shareClasses,
  currencyCode,
  entityUUID,
  suggestedClose,
  tentative,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  period: FundPeriod
  shareClasses: ShareClass[]
  currencyCode: string
  entityUUID: string
  suggestedClose?: Date | null
  tentative?: {
    grossNavPerShare?: number
    grossYield?: number
    mgmtFeePerShare?: number
    mgmtFeeTotal?: number
    netNavPerShare?: number
    netYield?: number
    totalShares?: number
    totalAum?: number
  }
  onSuccess: () => void
}) {
  const t = tentative ?? {}

  // Editable fields — pre-filled from tentative snapshot values
  const [grossNav, setGrossNav] = React.useState(t.grossNavPerShare != null ? String(t.grossNavPerShare) : "")
  const [mgmtFeePerShare, setMgmtFeePerShare] = React.useState(t.mgmtFeePerShare != null ? String(t.mgmtFeePerShare) : "")
  const [mgmtFeeTotal, setMgmtFeeTotal] = React.useState(t.mgmtFeeTotal != null ? String(t.mgmtFeeTotal) : "")
  const [navEnd, setNavEnd] = React.useState(
    t.netNavPerShare != null ? String(t.netNavPerShare) : (period.nav_end != null ? String(period.nav_end) : "")
  )
  const [totalSharesEnd, setTotalSharesEnd] = React.useState(
    t.totalShares != null ? String(t.totalShares) : (period.total_shares_end != null ? String(period.total_shares_end) : "")
  )
  const [pnlCosts, setPnlCosts] = React.useState("0")
  const [closedAt, setClosedAt] = React.useState<Date | undefined>(suggestedClose ?? new Date())
  const [notes, setNotes] = React.useState(period.notes ?? "")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Re-sync when tentative values change (e.g. dialog re-opens with fresh data)
  React.useEffect(() => {
    if (!open) return
    if (t.grossNavPerShare != null) setGrossNav(String(t.grossNavPerShare))
    if (t.mgmtFeePerShare != null) setMgmtFeePerShare(String(t.mgmtFeePerShare))
    if (t.mgmtFeeTotal != null) setMgmtFeeTotal(String(t.mgmtFeeTotal))
    if (t.netNavPerShare != null) setNavEnd(String(t.netNavPerShare))
    if (t.totalShares != null) setTotalSharesEnd(String(t.totalShares))
    if (suggestedClose) setClosedAt(suggestedClose)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const navValue = navEnd ? Number(navEnd) : null
  const grossNavValue = grossNav ? Number(grossNav) : null

  // Derive yields for display
  const grossYield = grossNavValue != null && period.nav_start != null && period.nav_start > 0
    ? (grossNavValue - period.nav_start) / period.nav_start : null
  const netYield = navValue != null && period.nav_start != null && period.nav_start > 0
    ? (navValue - period.nav_start) / period.nav_start : null

  function CcyField({ id, label, value, onChange, hint }: { id: string; label: React.ReactNode; value: string; onChange: (v: string) => void; hint?: React.ReactNode }) {
    return (
      <Field>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencyCode}</span>
          <Input id={id} type="number" min="0" step="0.0001" className="pl-12" placeholder="0.0000" value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </Field>
    )
  }

  async function handleConfirm() {
    if (!navValue || navValue <= 0) { setError("Net NAV per share is required."); return }
    setSaving(true)
    setError(null)
    try {
      const entityStats = await fetch(`/api/entity-stats/${entityUUID}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null) as { assetsValue: number; liabilitiesValue: number } | null

      const res = await fetch(`/api/fund-periods/${period.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "closed",
          closed_at: closedAt ? closedAt.getTime() : Date.now(),
          nav_end: navValue,
          ...(grossNavValue != null ? { nav_gross_end: grossNavValue } : {}),
          ...(grossYield != null ? { yield_gross: grossYield } : {}),
          ...(netYield != null ? { yield_net: netYield } : {}),
          ...(mgmtFeePerShare ? { management_fee_per_share: Number(mgmtFeePerShare) } : {}),
          ...(mgmtFeeTotal ? { management_fee_total: Number(mgmtFeeTotal) } : {}),
          // pnl_costs = actual P&L costs THIS period (0 by default; management_fee_total carries to NEXT period as its pnl_costs)
          pnl_costs: Number(pnlCosts) || 0,
          ...(totalSharesEnd ? { total_shares_end: Number(totalSharesEnd) } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(entityStats ? {
            total_invested_assets: entityStats.assetsValue,
            total_debt: entityStats.liabilitiesValue,
            // total_aum_end = row 14: assets − liabilities − pnl_costs
            total_aum_end: entityStats.assetsValue - entityStats.liabilitiesValue - (Number(pnlCosts) || 0),
          } : {}),
        }),
      })
      if (!res.ok) throw new Error("Failed to close period")

      await Promise.all(
        shareClasses.map((sc) =>
          fetch(`/api/share-classes/${sc.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ current_nav: navValue }),
          })
        )
      )

      // Auto-create a draft mutation group for the next period.
      // Only create placeholder subscriptions for cap table entries that have
      // pending or partial capital calls (new capital being deployed).
      try {
        const capTableEntries = await fetchCapTableEntries(entityUUID)
        // Filter to entries with at least one pending/partial capital call
        type EntryCandiate = { entryId: string; amount: number | null }
        const candidates: EntryCandiate[] = capTableEntries.flatMap((entry) => {
          // Capital calls that have not yet been deployed into a mutation
          const undeployedCalls = (entry._capital_call ?? []).filter(
            (cc) => cc.deployed_at == null
          )
          if (undeployedCalls.length === 0) return []
          const totalAmount = undeployedCalls.reduce((s, cc) => s + (cc.amount ?? 0), 0)
          return [{ entryId: entry.id, amount: totalAmount > 0 ? totalAmount : null }]
        })
        if (candidates.length > 0) {
          const newGroupRes = await fetch("/api/fund-mutation-groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entity: entityUUID, status: "draft" }),
          })
          if (newGroupRes.ok) {
            const newGroup = await newGroupRes.json() as { id: string }
            await Promise.all(
              candidates.map(({ entryId, amount }) => {
                const body: Record<string, unknown> = {
                  entity: entityUUID,
                  mutation_group: newGroup.id,
                  cap_table_entry: entryId,
                  type: "subscription",
                  nav_per_share: navValue,
                  mutation_at: Date.now(),
                }
                if (amount != null) {
                  body.amount_for_shares = amount
                  body.shares_issued = amount / navValue!
                }
                return fetch("/api/fund-mutations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                })
              })
            )
          }
        }
      } catch {
        // Non-fatal — period is already closed; user can create group manually
      }

      onSuccess()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Close period</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Review and confirm the closing values. All fields are editable before locking.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          {/* ── Section: Gross NAV ─────────────────────────────────────────── */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gross NAV</p>
          <CcyField
            id="gross-nav"
            label="Gross NAV per share"
            value={grossNav}
            onChange={setGrossNav}
            hint={grossYield != null ? <>Gross yield: <span className={grossYield >= 0 ? "text-green-600" : "text-red-600"}>{fmtPct(grossYield)}</span></> : undefined}
          />

          {/* ── Section: Management fee ────────────────────────────────────── */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Management fee</p>
          <div className="grid grid-cols-2 gap-3">
            <CcyField id="mgmt-fee-per-share" label="Fee per share" value={mgmtFeePerShare} onChange={setMgmtFeePerShare} />
            <CcyField id="mgmt-fee-total" label="Fee total" value={mgmtFeeTotal} onChange={setMgmtFeeTotal} />
          </div>

          {/* ── Section: Net NAV ───────────────────────────────────────────── */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Net NAV (closing)</p>
          <CcyField
            id="nav-end"
            label={<>Net NAV per share <span className="text-destructive">*</span></>}
            value={navEnd}
            onChange={setNavEnd}
            hint={netYield != null ? <>Net yield: <span className={netYield >= 0 ? "text-green-600" : "text-red-600"}>{fmtPct(netYield)}</span>{period.nav_start != null && navValue != null ? <> · {fmtCcy(period.nav_start, currencyCode)} → {fmtCcy(navValue, currencyCode)}</> : null}</> : undefined}
          />

          {/* ── Section: Period costs ──────────────────────────────────────── */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Period costs</p>
          <CcyField
            id="pnl-costs"
            label="P&L costs this period"
            value={pnlCosts}
            onChange={setPnlCosts}
            hint="Operational costs recorded against this period. Defaults to 0. Management fee is tracked separately above."
          />

          {/* ── Section: Shares ────────────────────────────────────────────── */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shares</p>
          <Field>
            <FieldLabel htmlFor="shares-end">Total shares at close</FieldLabel>
            <Input id="shares-end" type="number" min="0" step="0.0001" placeholder="0" value={totalSharesEnd} onChange={(e) => setTotalSharesEnd(e.target.value)} />
          </Field>

          {/* ── Closing date ───────────────────────────────────────────────── */}
          <DatePickerInput id="closed-at" label="Closing date" value={closedAt} onChange={setClosedAt} />

          <Field>
            <FieldLabel htmlFor="period-notes">Notes</FieldLabel>
            <Input id="period-notes" placeholder="Optional…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {error && <FieldError>{error}</FieldError>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={saving || !navValue}>
            {saving ? <Spinner className="size-4 mr-2" /> : <Lock className="size-4 mr-2" />}
            Close period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Period Card ──────────────────────────────────────────────────────────────

function PeriodCard({
  period,
  mutations,
  shareClasses,
  entityUUID,
  currencyCode,
  onRefresh,
}: {
  period: FundPeriod
  mutations: FundMutation[]
  shareClasses: ShareClass[]
  entityUUID: string
  currencyCode: string
  onRefresh: () => void
}) {
  const isOpen = period.status === "open"
  const [expanded, setExpanded] = React.useState(false)
  const [closeOpen, setCloseOpen] = React.useState(false)

  const navEnd = period.nav_end ?? null
  const returnPct =
    period.nav_start != null && navEnd != null && period.nav_start > 0
      ? (navEnd - period.nav_start) / period.nav_start
      : null
  const grossReturnPct =
    period.nav_start != null && period.nav_gross_end != null && period.nav_start > 0
      ? (period.nav_gross_end - period.nav_start) / period.nav_start
      : null

  const periodTitle = period.label ?? `Period — ${fmtDate(period.opened_at)}`
  // Row 14 (balance from financials): assets − liabilities − pnl_costs
  const balanceAum = period.total_aum_end ?? null
  const totalShares = period.total_shares_end ?? period.total_shares_start ?? null
  // Row 24 (reporting only): net NAV/share × shares at end
  const reportingAum = navEnd != null && totalShares != null ? navEnd * totalShares : null

  // ── Per-investor breakdown ────────────────────────────────────────────────
  // Aggregate net shares per cap_table_entry across all mutations in this period
  type InvestorRow = {
    entryId: string
    name: string | null
    email: string | null
    netShares: number
    totalIn: number   // amount_for_shares (subscriptions)
    totalOut: number  // amount_returned + amount_distributed
  }
  const investorMap = new Map<string, InvestorRow>()
  for (const m of mutations) {
    const entryId = m.cap_table_entry ?? m._cap_table_entry?.id ?? null
    if (!entryId) continue
    if (!investorMap.has(entryId)) {
      investorMap.set(entryId, {
        entryId,
        name: m._cap_table_entry?._shareholder?.name ?? null,
        email: m._cap_table_entry?._shareholder?.email ?? null,
        netShares: 0,
        totalIn: 0,
        totalOut: 0,
      })
    }
    const row = investorMap.get(entryId)!
    if (m.type === "subscription") {
      row.netShares += m.shares_issued ?? 0
      row.totalIn += m.amount_for_shares ?? 0
    } else if (m.type === "redemption") {
      row.netShares -= m.shares_redeemed ?? 0
      row.totalOut += m.amount_returned ?? 0
    } else if (m.type === "distribution") {
      row.totalOut += m.amount_distributed ?? 0
    }
  }
  const investors = Array.from(investorMap.values()).filter((r) => r.netShares > 0)
  const totalInvestorShares = investors.reduce((s, r) => s + r.netShares, 0)

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{periodTitle}</span>
              {isOpen ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">Open</span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-medium">Closed</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmtDate(period.opened_at)}
              {!isOpen && period.closed_at && ` → ${fmtDate(period.closed_at)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            {/* Step B financials in header */}
            {period.total_invested_assets != null && (
              <span>Assets: <span className="font-medium text-foreground">{fmtCcy(period.total_invested_assets, currencyCode)}</span></span>
            )}
            {period.total_debt != null && period.total_debt > 0 && (
              <span>Debt: <span className="font-medium text-red-600">−{fmtCcy(period.total_debt, currencyCode)}</span></span>
            )}
            {period.pnl_costs != null && period.pnl_costs > 0 && (
              <span>Costs: <span className="font-medium text-red-600">−{fmtCcy(period.pnl_costs, currencyCode)}</span></span>
            )}
            {balanceAum != null && (
              <span>Balance: <span className="font-medium text-foreground">{fmtCcy(balanceAum, currencyCode)}</span></span>
            )}
          </div>
          {isOpen && (
            <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
              <Lock className="size-3.5 mr-1.5" />
              Close period
            </Button>
          )}
        </div>
      </div>

      {/* ── Expanded body ──────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t">
          {/* Net NAV calculation strip (Step C) */}
          {!isOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 border-b bg-muted/20">
              {[
                {
                  label: "Gross NAV/share",
                  value: fmtCcy(period.nav_gross_end, currencyCode),
                  sub: grossReturnPct != null ? fmtPct(grossReturnPct) : null,
                  positive: (grossReturnPct ?? 0) >= 0,
                },
                {
                  label: "Mgmt fee total",
                  value: period.management_fee_total != null ? `−${fmtCcy(period.management_fee_total, currencyCode)}` : "—",
                  sub: period.management_fee_per_share != null ? `−${fmtCcy(period.management_fee_per_share, currencyCode)}/share` : null,
                  positive: false,
                },
                {
                  label: "Net NAV/share",
                  value: fmtCcy(navEnd, currencyCode),
                  sub: returnPct != null ? fmtPct(returnPct) : null,
                  positive: (returnPct ?? 0) >= 0,
                },
                {
                  label: "Shares outstanding",
                  value: totalShares != null ? fmt(totalShares, 4) : "—",
                  sub: null,
                  positive: true,
                },
                {
                  label: "Total AUM (reporting)",
                  value: fmtCcy(reportingAum, currencyCode),
                  sub: "net NAV × shares",
                  positive: true,
                },
              ].map(({ label, value, sub, positive }) => (
                <div key={label} className="px-4 py-3 flex flex-col gap-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold tabular-nums">{value}</p>
                  {sub && <p className={`text-[10px] ${label === "Total AUM (reporting)" || label === "Shares outstanding" ? "text-muted-foreground" : positive ? "text-emerald-600" : "text-red-600"}`}>{sub}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Per-investor breakdown (closed periods only, when there are investors) */}
          {!isOpen && investors.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Investor positions at close
              </p>
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-t">
                  <tr>
                    <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Investor</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Shares</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">% of fund</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Invested</th>
                    <th className="text-right py-2 px-4 text-xs font-medium text-muted-foreground">Value at close</th>
                  </tr>
                </thead>
                <tbody>
                  {investors.map((inv) => {
                    const valueAtClose = navEnd != null ? inv.netShares * navEnd : null
                    const pctOfFund = totalInvestorShares > 0 ? inv.netShares / totalInvestorShares : null
                    const gainLoss = valueAtClose != null ? valueAtClose - inv.totalIn : null
                    return (
                      <tr key={inv.entryId} className="border-b last:border-0">
                        <td className="py-2.5 px-4">
                          <div className="font-medium">{inv.name ?? "—"}</div>
                          {inv.email && <div className="text-xs text-muted-foreground">{inv.email}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{fmt(inv.netShares, 4)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                          {pctOfFund != null ? `${(pctOfFund * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{fmtCcy(inv.totalIn, currencyCode)}</td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="font-medium tabular-nums">{valueAtClose != null ? fmtCcy(valueAtClose, currencyCode) : "—"}</div>
                          {gainLoss != null && (
                            <div className={`text-[10px] tabular-nums ${gainLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {gainLoss >= 0 ? "+" : ""}{fmtCcy(gainLoss, currencyCode)}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {investors.length > 1 && reportingAum != null && (
                  <tfoot className="border-t bg-muted/20">
                    <tr>
                      <td className="py-2 px-4 text-xs font-semibold">Total</td>
                      <td className="py-2 px-3 text-right text-xs tabular-nums font-semibold">{fmt(totalInvestorShares, 4)}</td>
                      <td className="py-2 px-3 text-right text-xs text-muted-foreground">100%</td>
                      <td className="py-2 px-3 text-right text-xs tabular-nums font-semibold">{fmtCcy(investors.reduce((s, r) => s + r.totalIn, 0), currencyCode)}</td>
                      <td className="py-2 px-4 text-right text-xs tabular-nums font-semibold">{fmtCcy(reportingAum, currencyCode)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

        </div>
      )}

      {isOpen && (
        <ClosePeriodDialog
          open={closeOpen}
          onClose={() => setCloseOpen(false)}
          period={period}
          shareClasses={shareClasses}
          currencyCode={currencyCode}
          entityUUID={entityUUID}
          onSuccess={() => { setCloseOpen(false); onRefresh() }}
        />
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FundNavManager({
  entityUUID,
  currencyCode = "EUR",
  periodFrequency = null,
}: {
  entityUUID: string
  currencyCode?: string
  periodFrequency?: string | null
}) {
  const [groups, setGroups] = React.useState<MutationGroup[]>([])
  const [periods, setPeriods] = React.useState<FundPeriod[]>([])
  const [allMutations, setAllMutations] = React.useState<FundMutation[]>([])
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([])
  const [loading, setLoading] = React.useState(true)
  const [newGroupSaving, setNewGroupSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [groupsRes, periodsRes, mutationsRes, sc] = await Promise.all([
        fetch(`/api/fund-mutation-groups?entity=${entityUUID}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
        fetch(`/api/fund-periods?entity=${entityUUID}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
        fetch(`/api/fund-mutations?entity=${entityUUID}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
        fetchShareClasses(entityUUID),
      ])
      setGroups(groupsRes as MutationGroup[])
      setPeriods((periodsRes as FundPeriod[]).sort((a, b) => (b.opened_at ?? 0) - (a.opened_at ?? 0)))
      setAllMutations(mutationsRes as FundMutation[])
      setShareClasses(sc)
    } finally {
      setLoading(false)
    }
  }, [entityUUID])

  React.useEffect(() => { void load() }, [load])

  async function handleNewGroup() {
    setNewGroupSaving(true)
    try {
      await fetch("/api/fund-mutation-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: entityUUID, status: "draft" }),
      })
      await load()
    } finally {
      setNewGroupSaving(false)
    }
  }

  const openPeriod = periods.find((p) => p.status === "open") ?? null
  const closedPeriods = periods.filter((p) => p.status === "closed")
  const draftGroups = groups.filter((g) => g.status === "draft")
  const lastClosedPeriod = closedPeriods[0] ?? null

  // Group mutations by period id client-side
  const mutsByPeriod = React.useMemo(() => {
    const map = new Map<string, FundMutation[]>()
    for (const m of allMutations) {
      if (!m.period) continue
      const arr = map.get(m.period) ?? []
      arr.push(m)
      map.set(m.period, arr)
    }
    return map
  }, [allMutations])

  if (loading) {
    return <div className="flex items-center justify-center h-40"><Spinner className="size-5" /></div>
  }

  return (
    <div className="flex flex-col gap-8">

      {/* ── Open period snapshot ──────────────────────────────────────────── */}
      {openPeriod && (
        <OpenPeriodSnapshot
          period={openPeriod}
          mutations={mutsByPeriod.get(openPeriod.id) ?? []}
          currencyCode={currencyCode}
          entityUUID={entityUUID}
          shareClasses={shareClasses}
          previousPeriod={lastClosedPeriod}
          periodFrequency={periodFrequency}
          onRefresh={load}
        />
      )}

      {/* ── Draft mutations ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Draft mutations</h2>
          <Button size="sm" variant="outline" onClick={handleNewGroup} disabled={newGroupSaving}>
            {newGroupSaving ? <Spinner className="size-3.5 mr-1" /> : <Plus className="size-3.5 mr-1" />}
            New draft
          </Button>
        </div>

        {draftGroups.length === 0 ? (
          <div className="rounded-xl border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No draft mutations. Create a draft to stage subscriptions, redemptions, or distributions before opening a period.
            </p>
          </div>
        ) : (
          draftGroups.map((g) => (
            <MutationGroupCard
              key={g.id}
              group={g}
              entityUUID={entityUUID}
              previousPeriod={lastClosedPeriod}
              shareClasses={shareClasses}
              currencyCode={currencyCode}
              onRefresh={load}
            />
          ))
        )}
      </div>

      {/* ── Closed periods ────────────────────────────────────────────────── */}
      {closedPeriods.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Closed periods</h2>
          {closedPeriods.map((p) => (
            <PeriodCard
              key={p.id}
              period={p}
              mutations={mutsByPeriod.get(p.id) ?? []}
              shareClasses={shareClasses}
              entityUUID={entityUUID}
              currencyCode={currencyCode}
              onRefresh={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
