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
  total_aum_end?: number | null
  nav_gross_end?: number | null
  yield_net?: number | null
  yield_gross?: number | null
  management_fee_per_share?: number | null
  management_fee_total?: number | null
  pnl_costs?: number | null
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
          total_shares_start: totalSharesStart + newSharesIssued,
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
              <span className="text-muted-foreground">Total shares start</span>
              <span className="font-medium">{fmt(totalSharesStart + newSharesIssued, 4)}</span>
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

// ─── Mutation Group Card ──────────────────────────────────────────────────────

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
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  period: FundPeriod
  shareClasses: ShareClass[]
  currencyCode: string
  entityUUID: string
  onSuccess: () => void
}) {
  const [navEnd, setNavEnd] = React.useState(period.nav_end != null ? String(period.nav_end) : "")
  const [closedAt, setClosedAt] = React.useState<Date | undefined>(new Date())
  const [totalSharesEnd, setTotalSharesEnd] = React.useState(
    period.total_shares_end != null ? String(period.total_shares_end) : ""
  )
  const [notes, setNotes] = React.useState(period.notes ?? "")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const navValue = navEnd ? Number(navEnd) : null

  async function handleConfirm() {
    if (!navValue || navValue <= 0) { setError("Closing NAV per share is required."); return }
    setSaving(true)
    setError(null)
    try {
      // Snapshot entity stats at close time
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
          ...(totalSharesEnd ? { total_shares_end: Number(totalSharesEnd) } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(entityStats ? { total_invested_assets: entityStats.assetsValue, total_debt: entityStats.liabilitiesValue } : {}),
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close period</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Set the closing NAV and lock this period. Updates current NAV on all share classes.
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <Field>
            <FieldLabel htmlFor="nav-end">Closing NAV per share <span className="text-destructive">*</span></FieldLabel>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencyCode}</span>
              <Input
                id="nav-end"
                type="number" min="0" step="0.0001"
                className="pl-12"
                placeholder="1.0000"
                value={navEnd}
                onChange={(e) => setNavEnd(e.target.value)}
              />
            </div>
            {period.nav_start != null && navValue != null && (
              <p className="text-xs text-muted-foreground mt-1">
                Period return: {fmtPct((navValue - period.nav_start) / period.nav_start)}
                {" "}({fmtCcy(period.nav_start, currencyCode)} → {fmtCcy(navValue, currencyCode)})
              </p>
            )}
          </Field>
          <DatePickerInput id="closed-at" label="Closing date" value={closedAt} onChange={setClosedAt} />
          <Field>
            <FieldLabel htmlFor="shares-end">Total shares at close</FieldLabel>
            <Input
              id="shares-end"
              type="number" min="0" step="0.0001"
              placeholder={period.total_shares_start != null ? String(period.total_shares_start) : "0"}
              value={totalSharesEnd}
              onChange={(e) => setTotalSharesEnd(e.target.value)}
            />
          </Field>
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

// ─── Period Stats ─────────────────────────────────────────────────────────────

function PeriodStats({ period, currencyCode }: { period: FundPeriod; currencyCode: string }) {
  const isOpen = period.status === "open"
  const returnPct =
    period.nav_start != null && period.nav_end != null && period.nav_start > 0
      ? (period.nav_end - period.nav_start) / period.nav_start
      : null

  const stats = [
    {
      label: "Status", value: isOpen ? (
        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">Open</span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">Closed</span>
      )
    },
    { label: "Opened", value: fmtDate(period.opened_at) },
    { label: "Closed", value: isOpen ? "—" : fmtDate(period.closed_at) },
    { label: "NAV start", value: fmtCcy(period.nav_start, currencyCode) },
    { label: isOpen ? "NAV (current)" : "NAV end", value: fmtCcy(isOpen ? period.nav_start : period.nav_end, currencyCode) },
    { label: "AUM start", value: fmtCcy(period.total_aum_start, currencyCode) },
    { label: "Shares start", value: fmt(period.total_shares_start, 4) },
    ...(!isOpen ? [
      { label: "Shares end", value: fmt(period.total_shares_end, 4) },
      {
        label: "Period return", value: returnPct != null ? (
          <span className={returnPct >= 0 ? "text-emerald-600" : "text-red-600"}>{fmtPct(returnPct)}</span>
        ) : "—"
      },
    ] : []),
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ label, value }) => (
        <div key={label} className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="text-sm font-semibold mt-0.5">{value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FundNavManager({
  entityUUID,
  currencyCode = "EUR",
}: {
  entityUUID: string
  currencyCode?: string
}) {
  const [groups, setGroups] = React.useState<MutationGroup[]>([])
  const [periods, setPeriods] = React.useState<FundPeriod[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [mutations, setMutations] = React.useState<FundMutation[]>([])
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([])
  const [loading, setLoading] = React.useState(true)
  const [mutLoading, setMutLoading] = React.useState(false)
  const [closeOpen, setCloseOpen] = React.useState(false)
  const [newGroupSaving, setNewGroupSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [groupsRes, periodsRes, sc] = await Promise.all([
        fetch(`/api/fund-mutation-groups?entity=${entityUUID}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
        fetch(`/api/fund-periods?entity=${entityUUID}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
        fetchShareClasses(entityUUID),
      ])
      setGroups(groupsRes as MutationGroup[])
      const sorted: FundPeriod[] = (periodsRes as FundPeriod[]).sort(
        (a, b) => (b.opened_at ?? 0) - (a.opened_at ?? 0)
      )
      setPeriods(sorted)
      setShareClasses(sc)
      const openPeriod = sorted.find((p) => p.status === "open")
      setSelectedId((prev) => prev ?? openPeriod?.id ?? sorted[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [entityUUID])

  React.useEffect(() => { void load() }, [load])

  React.useEffect(() => {
    if (!selectedId) return
    setMutLoading(true)
    fetch(`/api/fund-mutations?period=${selectedId}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : [])
      .then((data: FundMutation[]) => setMutations(data))
      .finally(() => setMutLoading(false))
  }, [selectedId])

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

  const draftGroups = groups.filter((g) => g.status === "draft")
  const selectedPeriod = periods.find((p) => p.id === selectedId) ?? null
  const lastClosedPeriod = periods
    .filter((p) => p.status === "closed")
    .sort((a, b) => (b.opened_at ?? 0) - (a.opened_at ?? 0))[0] ?? null

  if (loading) {
    return <div className="flex items-center justify-center h-40"><Spinner className="size-5" /></div>
  }

  return (
    <div className="flex flex-col gap-8">

      {/* ── Mutation Groups ───────────────────────────────────────────────── */}
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

      {/* ── Periods ───────────────────────────────────────────────────────── */}
      {periods.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold">Periods</h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {periods.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  p.id === selectedId
                    ? "border-primary bg-primary/5 text-primary"
                    : "hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                {p.label ?? fmtDate(p.opened_at)}
                {p.status === "open" && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[10px] font-medium">
                    Open
                  </span>
                )}
              </button>
            ))}
          </div>

          {selectedPeriod && (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">
                    {selectedPeriod.label ?? `Period opened ${fmtDate(selectedPeriod.opened_at)}`}
                  </h3>
                  {selectedPeriod.notes && (
                    <p className="text-sm text-muted-foreground mt-0.5">{selectedPeriod.notes}</p>
                  )}
                </div>
                {selectedPeriod.status === "open" && (
                  <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
                    <Lock className="size-3.5 mr-1.5" />
                    Close period
                  </Button>
                )}
              </div>

              <PeriodStats period={selectedPeriod} currencyCode={currencyCode} />

              <div>
                <h4 className="text-sm font-semibold mb-3">Past mutations</h4>
                {mutLoading ? (
                  <div className="flex items-center justify-center h-20"><Spinner className="size-4" /></div>
                ) : mutations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No mutations for this period.</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <MutationRows mutations={mutations} currencyCode={currencyCode} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {selectedPeriod?.status === "open" && (
        <ClosePeriodDialog
          open={closeOpen}
          onClose={() => setCloseOpen(false)}
          period={selectedPeriod}
          shareClasses={shareClasses}
          currencyCode={currencyCode}
          entityUUID={entityUUID}
          onSuccess={() => { setCloseOpen(false); void load() }}
        />
      )}
    </div>
  )
}
