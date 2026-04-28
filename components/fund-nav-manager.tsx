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
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerInput } from "@/components/date-input"
import { fetchShareClasses, fetchCapTableEntries, type ShareClass, type CapTableEntry, type CapitalCall } from "@/lib/cap-table"
import { Lock, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react"

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

function MutationRows({ mutations, currencyCode, footer, onEdit, onDelete }: {
  mutations: FundMutation[]
  currencyCode: string
  footer?: React.ReactNode
  onEdit?: (m: FundMutation) => void
  onDelete?: (m: FundMutation) => void
}) {
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
          {(onEdit || onDelete) && <th className="py-2 px-3" />}
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
              {(onEdit || onDelete) && (
                <td className="py-2 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {onEdit && (
                      <Button variant="ghost" size="icon" className="size-6" onClick={() => onEdit(m)}>
                        <Pencil className="size-3" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(m)}>
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
      {footer}
    </table>
  )
}

// ─── Add Mutation Dialog ──────────────────────────────────────────────────────

function AddMutationDialog({
  open,
  onClose,
  entityUUID,
  periodId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  entityUUID: string
  periodId: string | null
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
        ...(periodId ? { period: periodId } : {}),
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

// ─── Deploy Call Dialog ───────────────────────────────────────────────────────
// Converts a single undeployed capital call into a fund_mutation subscription.
// If no period is open, also creates one.

function DeployCallDialog({
  open,
  onClose,
  entityUUID,
  call,
  entry,
  openPeriod,
  previousPeriod,
  currencyCode,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  entityUUID: string
  call: CapitalCall
  entry: CapTableEntry
  openPeriod: FundPeriod | null
  previousPeriod: FundPeriod | null
  currencyCode: string
  onSuccess: () => void
}) {
  const defaultNav = call._share_class?.current_nav ?? openPeriod?.nav_start ?? null
  const [navPerShare, setNavPerShare] = React.useState(defaultNav != null ? String(defaultNav) : "")
  const [amountInvested, setAmountInvested] = React.useState(call.amount != null ? String(call.amount) : "")
  const [feeRate, setFeeRate] = React.useState("")
  const [feeAmountOverride, setFeeAmountOverride] = React.useState("")
  const [mutationAt, setMutationAt] = React.useState<Date | undefined>(new Date())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const nav = navPerShare ? Number(navPerShare) : null
  const grossAmount = amountInvested ? Number(amountInvested) : 0
  // fee_amount: manual override takes precedence, otherwise derived from fee_rate
  const feeAmount = feeAmountOverride !== ""
    ? Number(feeAmountOverride)
    : feeRate ? (grossAmount * Number(feeRate)) / 100 : 0
  const amountForShares = grossAmount - feeAmount
  const sharesIssued = nav && nav > 0 && amountForShares > 0 ? amountForShares / nav : null

  async function handleDeploy() {
    if (!nav || nav <= 0) { setError("NAV per share is required."); return }
    if (grossAmount <= 0) { setError("Amount invested is required."); return }
    setSaving(true); setError(null)
    try {
      const mutRes = await fetch("/api/fund-subscribe-mutation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityUUID,
          periodId: openPeriod?.id ?? null,
          cap_table_entry: entry.id,
          nav_per_share: nav,
          amount_invested: grossAmount,
          ...(feeRate ? { fee_rate: Number(feeRate) / 100 } : {}),
          ...(feeAmount > 0 ? { fee_amount: feeAmount } : {}),
          amount_for_shares: amountForShares,
          shares_issued: sharesIssued,
          mutation_at: mutationAt ? mutationAt.getTime() : Date.now(),
          callId: call.id,
          fundShareholderId: entry._shareholder?.id ?? "",
        }),
      })
      if (!mutRes.ok) throw new Error("Failed to create mutation")
      onSuccess()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to subscribe")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe</DialogTitle>
          <p className="text-sm text-muted-foreground">Convert this capital call into a fund subscription mutation.</p>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <div className="rounded-lg border p-3 bg-muted/30 text-sm flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Investor</span>
              <span className="font-medium">{entry._shareholder?.name ?? "—"}</span>
            </div>
            {call._share_class?.name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Share class</span>
                <span className="font-medium">{call._share_class.name}</span>
              </div>
            )}
            {openPeriod && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period</span>
                <span className="font-medium">{openPeriod.label ?? fmtDate(openPeriod.opened_at)}</span>
              </div>
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="deploy-nav">NAV per share</FieldLabel>
            <Input id="deploy-nav" type="number" min="0" step="0.0001" placeholder="0.0000" value={navPerShare} onChange={(e) => setNavPerShare(e.target.value)} />
          </Field>

          <Field>
            <FieldLabel htmlFor="deploy-gross">Amount invested (gross)</FieldLabel>
            <Input id="deploy-gross" type="number" min="0" step="0.01" placeholder="0.00" value={amountInvested} onChange={(e) => setAmountInvested(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="deploy-fee-rate">Entry fee rate (%)</FieldLabel>
              <Input id="deploy-fee-rate" type="number" min="0" step="0.01" placeholder="0.00" value={feeRate} onChange={(e) => { setFeeRate(e.target.value); setFeeAmountOverride("") }} />
            </Field>
            <Field>
              <FieldLabel htmlFor="deploy-fee-amount">Fee amount</FieldLabel>
              <Input id="deploy-fee-amount" type="number" min="0" step="0.01" placeholder="0.00" value={feeAmountOverride !== "" ? feeAmountOverride : feeAmount > 0 ? String(feeAmount) : ""} onChange={(e) => setFeeAmountOverride(e.target.value)} />
            </Field>
          </div>

          <div className="rounded-lg border p-3 bg-muted/30 text-sm flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount for shares</span>
              <span className="font-medium">{fmtCcy(amountForShares, currencyCode)}</span>
            </div>
            {sharesIssued != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shares to issue</span>
                <span className="font-medium">{fmt(sharesIssued, 4)}</span>
              </div>
            )}
          </div>

          <DatePickerInput id="deploy-date" label="Subscription date" value={mutationAt} onChange={setMutationAt} />
          {error && <FieldError>{error}</FieldError>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleDeploy} disabled={saving || !nav || grossAmount <= 0}>
            {saving && <Spinner className="size-4 mr-2" />}
            Subscribe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Subscribe All Dialog ─────────────────────────────────────────────────────

function SubscribeAllDialog({
  open,
  onClose,
  entityUUID,
  calls,
  openPeriod,
  previousPeriod,
  currencyCode,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  entityUUID: string
  calls: Array<{ call: CapitalCall; entry: CapTableEntry }>
  openPeriod: FundPeriod | null
  previousPeriod: FundPeriod | null
  currencyCode: string
  onSuccess: () => void
}) {
  const defaultNav = openPeriod?.nav_start ?? null
  const [navPerShare, setNavPerShare] = React.useState(defaultNav != null ? String(defaultNav) : "")
  const [feeRate, setFeeRate] = React.useState("")
  const [mutationAt, setMutationAt] = React.useState<Date | undefined>(new Date())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const nav = navPerShare ? Number(navPerShare) : null
  const feeRateNum = feeRate ? Number(feeRate) : 0
  const totalGross = calls.reduce((s, { call }) => s + (call.amount ?? 0), 0)
  const totalFees = totalGross * feeRateNum / 100
  const totalForShares = totalGross - totalFees

  React.useEffect(() => {
    if (open) {
      setNavPerShare(openPeriod?.nav_start != null ? String(openPeriod.nav_start) : "")
      setFeeRate(""); setMutationAt(new Date()); setError(null)
    }
  }, [open, openPeriod?.nav_start])

  async function handleSubscribeAll() {
    if (!nav || nav <= 0) { setError("NAV per share is required."); return }
    setSaving(true); setError(null)
    try {
      const mutationTs = mutationAt ? mutationAt.getTime() : Date.now()
      await Promise.all(
        calls.map(async ({ call, entry }) => {
          const gross = call.amount ?? 0
          const feeAmt = gross * feeRateNum / 100
          const amountForShares = gross - feeAmt
          const sharesIssued = nav > 0 && amountForShares > 0 ? amountForShares / nav : null
          await fetch("/api/fund-subscribe-mutation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entityUUID,
              periodId: openPeriod?.id ?? null,
              cap_table_entry: entry.id,
              nav_per_share: nav,
              amount_invested: gross,
              ...(feeRateNum > 0 ? { fee_rate: feeRateNum / 100 } : {}),
              ...(feeAmt > 0 ? { fee_amount: feeAmt } : {}),
              amount_for_shares: amountForShares,
              shares_issued: sharesIssued,
              mutation_at: mutationTs,
              callId: call.id,
              fundShareholderId: entry._shareholder?.id ?? "",
            }),
          })
        })
      )
      onSuccess()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to subscribe")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe all</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Create subscription mutations for all {calls.length} pending capital call{calls.length !== 1 ? "s" : ""}.
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <div className="rounded-lg border p-3 bg-muted/30 text-sm flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Investors</span>
              <span className="font-medium">{calls.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total gross</span>
              <span className="font-medium">{fmtCcy(totalGross, currencyCode)}</span>
            </div>
            {openPeriod && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period</span>
                <span className="font-medium">{openPeriod.label ?? fmtDate(openPeriod.opened_at)}</span>
              </div>
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="sa-nav">NAV per share</FieldLabel>
            <Input id="sa-nav" type="number" min="0" step="0.0001" placeholder="0.0000" value={navPerShare} onChange={(e) => setNavPerShare(e.target.value)} />
          </Field>

          <Field>
            <FieldLabel htmlFor="sa-fee-rate">Entry fee rate (%) — applied to all</FieldLabel>
            <Input id="sa-fee-rate" type="number" min="0" step="0.01" placeholder="0.00" value={feeRate} onChange={(e) => setFeeRate(e.target.value)} />
          </Field>

          <div className="rounded-lg border p-3 bg-muted/30 text-sm flex flex-col gap-1">
            {totalFees > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total fees</span>
                <span className="font-medium text-red-600">−{fmtCcy(totalFees, currencyCode)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total for shares</span>
              <span className="font-medium">{fmtCcy(totalForShares, currencyCode)}</span>
            </div>
            {nav && nav > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total shares to issue</span>
                <span className="font-medium">{fmt(totalForShares / nav, 4)}</span>
              </div>
            )}
          </div>

          <DatePickerInput id="sa-date" label="Subscription date" value={mutationAt} onChange={setMutationAt} />
          {error && <FieldError>{error}</FieldError>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubscribeAll} disabled={saving || !nav}>
            {saving && <Spinner className="size-4 mr-2" />}
            Subscribe all ({calls.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Open Period Dialog ───────────────────────────────────────────────────────

function OpenPeriodDialog({
  open, onClose, entityUUID, previousPeriod, pendingMutations, currencyCode, periodFrequency, onSuccess,
}: {
  open: boolean
  onClose: () => void
  entityUUID: string
  previousPeriod: FundPeriod | null
  pendingMutations: FundMutation[]
  currencyCode: string
  periodFrequency?: string | null
  onSuccess: () => void
}) {
  // Compute suggested opening values from mutations
  const pendingSubs = pendingMutations.filter((m) => m.type === "subscription")
  const newSharesIssued = pendingSubs.reduce((s, m) => s + (m.shares_issued ?? 0), 0)
  const redeemedShares = pendingMutations.filter((m) => m.type === "redemption").reduce((s, m) => s + (m.shares_redeemed ?? 0), 0)
  const subsAum = pendingSubs.reduce((s, m) => s + (m.amount_for_shares ?? 0), 0)
  const redemptionsAum = pendingMutations.filter((m) => m.type === "redemption").reduce((s, m) => s + (m.amount_returned ?? 0), 0)
  const distributionsAum = pendingMutations.filter((m) => m.type === "distribution").reduce((s, m) => s + (m.amount_distributed ?? 0), 0)
  const suggestedNav = pendingSubs[0]?.nav_per_share ?? previousPeriod?.nav_gross_end ?? previousPeriod?.nav_end ?? null
  const suggestedShares = (previousPeriod?.total_shares_end ?? 0) + newSharesIssued - redeemedShares
  const prevAum = previousPeriod?.total_aum_end ?? ((previousPeriod?.total_shares_end != null && previousPeriod?.nav_end != null) ? (previousPeriod.total_shares_end * previousPeriod.nav_end) : 0)
  // AUM = NAV per share × total shares (never add/subtract AUM components)
  const suggestedAum = suggestedNav != null && suggestedShares > 0 ? suggestedNav * suggestedShares : 0

  // Suggested opening date = last period close + 1 day
  const suggestedOpenDate = React.useMemo(() => {
    if (previousPeriod?.closed_at) return new Date(previousPeriod.closed_at + 86400000)
    return new Date()
  }, [previousPeriod?.closed_at])

  const [label, setLabel] = React.useState("")
  const [openedAt, setOpenedAt] = React.useState<Date | undefined>(suggestedOpenDate)
  const [navStart, setNavStart] = React.useState(suggestedNav != null ? String(suggestedNav) : "")
  const [sharesStart, setSharesStart] = React.useState(String(suggestedShares.toFixed(4)))
  // AUM is always derived: nav × shares
  const computedAum = (parseFloat(navStart) || 0) * (parseFloat(sharesStart) || 0)
  const aumStart = computedAum > 0 ? computedAum.toFixed(2) : ""
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setLabel("")
      setOpenedAt(suggestedOpenDate)
      setNavStart(suggestedNav != null ? String(suggestedNav) : "")
      setSharesStart(String(suggestedShares.toFixed(4)))
      setError(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Summary rows showing breakdown
  const prevShares = previousPeriod?.total_shares_end ?? 0
  const prevGrossNav = previousPeriod?.nav_gross_end ?? previousPeriod?.nav_end ?? suggestedNav ?? 0
  const prevAumDisplay = previousPeriod?.total_aum_end ?? (prevShares && prevGrossNav ? prevShares * prevGrossNav : 0)
  const summaryRows = [
    previousPeriod ? { label: `End of ${previousPeriod.label ?? "last period"}`, shares: prevShares || null, aum: prevAumDisplay || null } : null,
    distributionsAum > 0 ? { label: "Distributions paid", shares: null, aum: -distributionsAum } : null,
    redeemedShares > 0 ? { label: "Redemptions", shares: -redeemedShares, aum: redeemedShares && prevGrossNav ? -(redeemedShares * prevGrossNav) : -redemptionsAum } : null,
    newSharesIssued > 0 ? { label: "New subscriptions", shares: newSharesIssued, aum: subsAum } : null,
  ].filter(Boolean) as Array<{ label: string; shares: number | null; aum: number | null }>

  async function handleOpen() {
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/fund-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: entityUUID,
          status: "open",
          label: label || null,
          opened_at: openedAt ? openedAt.getTime() : Date.now(),
          ...(navStart ? { nav_start: Number(navStart) } : {}),
          total_shares_start: sharesStart ? Number(sharesStart) : 0,
          ...(aumStart ? { total_aum_start: Number(aumStart) } : {}),
        }),
      })
      if (!res.ok) throw new Error("Failed to open period")
      const newPeriod = await res.json() as { id: string }
      if (pendingMutations.length > 0) {
        await Promise.all(
          pendingMutations.map((m) =>
            fetch(`/api/fund-mutations/${m.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ period: newPeriod.id }),
            })
          )
        )
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
        <DialogHeader><DialogTitle>Open new period</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 py-1">
          {/* Breakdown summary */}
          {summaryRows.length > 0 && (
            <div className="rounded-lg border overflow-hidden text-sm">
              <table className="w-full">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left py-1.5 px-3 text-xs font-medium text-muted-foreground">Item</th>
                    <th className="text-right py-1.5 px-3 text-xs font-medium text-muted-foreground">Shares</th>
                    <th className="text-right py-1.5 px-3 text-xs font-medium text-muted-foreground">AUM</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row, i) => {
                    const negative = (row.shares ?? 0) < 0 || (row.aum ?? 0) < 0
                    const positive = (row.shares ?? 0) > 0 || ((row.aum ?? 0) > 0 && i > 0)
                    const color = negative ? "text-red-600" : positive ? "text-emerald-600" : ""
                    return (
                      <tr key={i} className="border-b last:border-0">
                        <td className={`py-1.5 px-3 ${color}`}>{row.label}</td>
                        <td className={`py-1.5 px-3 text-right tabular-nums ${color}`}>
                          {row.shares != null ? (row.shares >= 0 ? fmt(row.shares, 4) : `−${fmt(Math.abs(row.shares), 4)}`) : "—"}
                        </td>
                        <td className={`py-1.5 px-3 text-right tabular-nums ${color}`}>
                          {row.aum != null ? (row.aum >= 0 ? fmtCcy(row.aum, currencyCode) : `−${fmtCcy(Math.abs(row.aum), currencyCode)}`) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t bg-muted/20">
                  <tr>
                    <td className="py-1.5 px-3 text-xs font-semibold">Opening position</td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-xs font-semibold">{fmt(suggestedShares, 4)}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-xs font-semibold">{suggestedAum > 0 ? fmtCcy(suggestedAum, currencyCode) : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Confirm / override opening values */}
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="op-nav">NAV per share</FieldLabel>
              <Input id="op-nav" type="number" min="0" step="0.0001" placeholder="0.0000"
                value={navStart} onChange={(e) => setNavStart(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="op-shares">Total shares</FieldLabel>
              <Input id="op-shares" type="number" min="0" step="0.0001" placeholder="0.0000"
                value={sharesStart} onChange={(e) => setSharesStart(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="op-aum">AUM start</FieldLabel>
              <Input id="op-aum" type="number" min="0" step="0.01" placeholder="0.00"
                value={aumStart} readOnly className="bg-muted/50" />
              <p className="text-[11px] text-muted-foreground mt-0.5">NAV × shares</p>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="op-label">Period label</FieldLabel>
              <Input id="op-label" placeholder="e.g. Period 2" value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <DatePickerInput id="op-opened-at" label="Opening date" value={openedAt} onChange={setOpenedAt} />
          </div>

          {periodFrequency && previousPeriod?.closed_at && (
            <p className="text-xs text-muted-foreground">
              Opening date suggested from last period close ({fmtDate(previousPeriod.closed_at)}) + 1 day
            </p>
          )}

          {error && <FieldError>{error}</FieldError>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleOpen} disabled={saving}>
            {saving ? <Spinner className="size-4 mr-2" /> : <Plus className="size-4 mr-2" />}
            Open period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Investor Position (computed from mutations) ──────────────────────────────

type InvestorPosition = {
  entryId: string
  name: string | null
  email: string | null
  shareClass: string | null
  netShares: number
  totalIn: number
  committedAmount: number | null
}

function computeCurrentPositions(
  allMutations: FundMutation[],
  capTableEntries: CapTableEntry[],
  executedTransfers: Array<{
    id: string
    seller_cap_table_entry?: string | null
    buyer_cap_table_entry?: string | null
    seller_mutation?: string | null
    buyer_mutation?: string | null
    shares?: number | null
    status?: string | null
  }> = [],
): InvestorPosition[] {
  const entryMap = new Map(capTableEntries.map((e) => [e.id, e]))
  const posMap = new Map<string, InvestorPosition>()
  const mutationIds = new Set<string>()
  for (const m of allMutations) {
    if (m.id) mutationIds.add(m.id)
    if (!m.period) continue
    const entryId = m.cap_table_entry ?? m._cap_table_entry?.id ?? null
    if (!entryId) continue
    if (!posMap.has(entryId)) {
      const entry = entryMap.get(entryId)
      posMap.set(entryId, {
        entryId,
        name: m._cap_table_entry?._shareholder?.name ?? null,
        email: m._cap_table_entry?._shareholder?.email ?? null,
        shareClass: entry?.share_class ?? null,
        netShares: 0,
        totalIn: 0,
        committedAmount: entry?.committed_amount ?? null,
      })
    }
    const pos = posMap.get(entryId)!
    if (m.type === "subscription") {
      pos.netShares += m.shares_issued ?? 0
      pos.totalIn += m.amount_for_shares ?? 0
    } else if (m.type === "redemption") {
      pos.netShares -= m.shares_redeemed ?? 0
    }
  }
  // Apply executed share_transfers whose paired fund_mutations are missing.
  // Guards against legacy transfers where one side's mutation was never created.
  for (const t of executedTransfers) {
    const shares = t.shares ?? 0
    if (shares <= 0) continue
    if (t.seller_cap_table_entry && (!t.seller_mutation || !mutationIds.has(t.seller_mutation))) {
      const existing = posMap.get(t.seller_cap_table_entry)
      if (existing) existing.netShares -= shares
    }
    if (t.buyer_cap_table_entry && (!t.buyer_mutation || !mutationIds.has(t.buyer_mutation))) {
      const existing = posMap.get(t.buyer_cap_table_entry)
      if (existing) existing.netShares += shares
    }
  }
  // Epsilon filters out positions that are effectively zero after rounding —
  // e.g. a redeem + transfer that nets to ~0.000001 due to float math.
  return Array.from(posMap.values()).filter((p) => p.netShares > 0.0001)
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
  priorPeriods,
  periodFrequency,
  receivedUndeployedTotal,
  onRefresh,
}: {
  period: FundPeriod
  mutations: FundMutation[]
  currencyCode: string
  entityUUID: string
  shareClasses: ShareClass[]
  previousPeriod: FundPeriod | null
  priorPeriods: FundPeriod[]
  periodFrequency?: string | null
  receivedUndeployedTotal: number
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
    // Total invested assets:
    // 1. Equity stakes with cap_table_shareholder → live value from shares × NAV
    // 2. All other non-cash assets → ledger balance (tx entries + mutations)
    import("@/lib/entity-assets").then(({ fetchEntityAssets }) =>
      Promise.all([
        fetchEntityAssets(entityUUID),
        fetch(`/api/transaction-entries?entity=${entityUUID}`).then((r) => r.ok ? r.json() : { entries: [] }).catch(() => ({ entries: [] })),
        fetch(`/api/mutations?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch(`/api/entity-stats/${entityUUID}`).then((r) => r.ok ? r.json() : null).catch(() => null),
      ]).then(async ([assets, entriesPayload, muts, cached]) => {
        // Build ledger balance per asset from tx entries + mutations
        const rawEntries = Array.isArray((entriesPayload as { entries?: unknown[] }).entries)
          ? (entriesPayload as { entries: Array<{ object_id?: string; direction?: string; amount?: number }> }).entries
          : []
        const balanceByAsset = new Map<string, number>()
        for (const e of rawEntries) {
          if (!e.object_id) continue
          balanceByAsset.set(e.object_id, (balanceByAsset.get(e.object_id) ?? 0) + (e.direction === "in" ? (e.amount ?? 0) : -(e.amount ?? 0)))
        }
        for (const m of muts as Array<{ asset?: string; delta?: number }>) {
          if (!m.asset) continue
          balanceByAsset.set(m.asset, (balanceByAsset.get(m.asset) ?? 0) + (m.delta ?? 0))
        }

        // Fetch live values for equity stakes linked to other funds
        const stakeAssets = assets.filter(
          (a) => a.investable === "equity_stake" && a.capTableShareholder && a.shareholderEntityId
        )
        const stakeValues = new Map<string, number>()
        await Promise.all(
          stakeAssets.map(async (a) => {
            try {
              const res = await fetch(
                `/api/cap-table-stake-value-by-shares?shareholder=${a.capTableShareholder}&fundEntity=${a.shareholderEntityId}`
              )
              if (!res.ok) return
              const val = (await res.json()) as { value?: number }
              if (typeof val.value === "number" && val.value > 0) stakeValues.set(a.id, val.value)
            } catch { /* ignore */ }
          })
        )

        let totalInvested = 0
        for (const a of assets) {
          if (a.investable === "investable_cash") continue
          const liveStake = stakeValues.get(a.id)
          if (liveStake != null) {
            totalInvested += liveStake
          } else if (a.investable === "equity_stake" && a.stakeValue != null && a.stakeValue > 0) {
            totalInvested += a.stakeValue
          } else {
            const bal = balanceByAsset.get(a.id) ?? 0
            if (bal > 0) totalInvested += bal
          }
        }

        setStats({
          assetsValue: totalInvested,
          liabilitiesValue: cached?.liabilitiesValue ?? 0,
        })
        setStatsLoading(false)
      })
    ).catch(() => setStatsLoading(false))
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
  // Subtract received-but-undeployed capital — that cash is in the fund bank account
  // but hasn't been processed as a subscription mutation yet (belongs to next period).
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

  const mgmtFeesRaw = shareClasses.flatMap((sc) =>
    (sc._share_class_fee ?? []).filter((f) => f.type === "management")
  )
  // Dedupe fees that are identical across share classes (same rate/basis) so a
  // fund with N classes sharing one rule doesn't get its fee multiplied by N.
  const mgmtFees = Array.from(
    new Map(
      mgmtFeesRaw.map((f) => [
        `${f.basis}|${f.rate ?? ""}|${f.rate_is_annual ?? ""}|${f.fixed_amount ?? ""}`,
        f,
      ]),
    ).values(),
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
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
            <Lock className="size-3.5 mr-1.5" />
            Close period
          </Button>
        </div>
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
                value={liabilitiesValue != null && liabilitiesValue > 0 ? <span className="text-red-600">−{fmtCcy(liabilitiesValue, currencyCode)}</span> : liabilitiesValue === 0 ? fmtCcy(0, currencyCode) : "—"}
              />
              <SnapRow label="Gross AUM" value={grossAum != null ? fmtCcy(grossAum, currencyCode) : "—"} />
              <SnapRow
                label="Costs"
                value={<span className="text-muted-foreground">Manual entry at close</span>}
              />
              <SnapRow
                label="Net AUM"
                value={grossAum != null ? fmtCcy(grossAum, currencyCode) : "—"}
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
                  {grossNavPerShare != null && grossNavPerShare > 0 && grossYield != null && (
                    <span className={`text-[10px] ${grossYield >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {grossYield >= 0 ? "+" : ""}{fmtPct(grossYield)}
                    </span>
                  )}
                </span>
              }
            />
            <SnapRow
              label={`Management fee/share${mgmtFeeRate ? ` (${mgmtFeeRate})` : ""}`}
              value={mgmtFeePerShare != null && mgmtFeePerShare > 0
                ? <span className="text-red-600">−{fmtCcy(mgmtFeePerShare, currencyCode)}</span>
                : <span className="text-muted-foreground">—</span>}
            />
            <SnapRow
              label="Management fee total"
              value={mgmtFeeTotal != null && mgmtFeeTotal > 0
                ? <span className="text-red-600">−{fmtCcy(mgmtFeeTotal, currencyCode)}</span>
                : <span className="text-muted-foreground">—</span>}
            />
            <SnapRow
              label="Net NAV/share"
              value={
                <span className="flex items-center gap-2">
                  <span>{netNavPerShare != null ? fmtCcy(netNavPerShare, currencyCode) : statsLoading ? "Loading…" : "—"}</span>
                  {netNavPerShare != null && netNavPerShare > 0 && netYield != null && (
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
        receivedUndeployedTotal={receivedUndeployedTotal}
        cumulativeFees={0}
        periodFrequency={periodFrequency}
        tentative={{
          grossNavPerShare: grossNavPerShare ?? undefined,
          grossYield: grossYield ?? undefined,
          mgmtFeePerShare: mgmtFeePerShare ?? undefined,
          mgmtFeeTotal: mgmtFeeTotal ?? undefined,
          netNavPerShare: netNavPerShare ?? undefined,
          netYield: netYield ?? undefined,
          totalShares: currentShares,
          totalAum: tentativeNetAum ?? undefined,
          assetsValue: assetsValue ?? undefined,
          liabilitiesValue: liabilitiesValue ?? undefined,
        }}
        onSuccess={() => { setCloseOpen(false); onRefresh() }}
      />
    </div>
  )
}

// ─── Close Period Dialog helpers (defined outside to avoid remount on each render) ──

function CcyField({ id, label, value, onChange, hint, readOnly, currencyCode }: {
  id: string; label: React.ReactNode; value: string; onChange?: (v: string) => void; hint?: React.ReactNode; readOnly?: boolean; currencyCode: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencyCode}</span>
        <Input
          id={id} type="number" min="0" step="0.0001" className={`pl-12 ${readOnly ? "bg-muted text-muted-foreground" : ""}`}
          placeholder="0.0000" value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={readOnly}
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </Field>
  )
}

function ReadRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
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
  receivedUndeployedTotal = 0,
  cumulativeFees = 0,
  periodFrequency = null,
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
  receivedUndeployedTotal?: number
  cumulativeFees?: number
  periodFrequency?: string | null
  tentative?: {
    grossNavPerShare?: number
    grossYield?: number
    mgmtFeePerShare?: number
    mgmtFeeTotal?: number
    netNavPerShare?: number
    netYield?: number
    totalShares?: number
    totalAum?: number
    assetsValue?: number
    liabilitiesValue?: number
  }
  onSuccess: () => void
}) {
  const t = tentative ?? {}
  const [step, setStep] = React.useState<1 | 2>(1)

  // ── Step 1: Financials ──────────────────────────────────────────────────────
  const [totalInvestedAssets, setTotalInvestedAssets] = React.useState("")
  const [totalDebt, setTotalDebt] = React.useState("")
  const [pnlCosts, setPnlCosts] = React.useState(cumulativeFees > 0 ? String(cumulativeFees) : "0")
  const [totalSharesEnd, setTotalSharesEnd] = React.useState(
    t.totalShares != null ? String(t.totalShares) : (period.total_shares_end != null ? String(period.total_shares_end) : "")
  )
  const [closedAt, setClosedAt] = React.useState<Date | undefined>(suggestedClose ?? new Date())
  const [notes, setNotes] = React.useState(period.notes ?? "")

  // ── Step 2: NAV Calculation ─────────────────────────────────────────────────
  const [grossNav, setGrossNav] = React.useState(t.grossNavPerShare != null ? String(t.grossNavPerShare) : "")
  const [mgmtFeePerShareField, setMgmtFeePerShareField] = React.useState(t.mgmtFeePerShare != null ? String(t.mgmtFeePerShare) : "")
  const [mgmtFeeTotalField, setMgmtFeeTotalField] = React.useState(t.mgmtFeeTotal != null ? String(t.mgmtFeeTotal) : "")
  const [navEnd, setNavEnd] = React.useState(
    t.netNavPerShare != null ? String(t.netNavPerShare) : (period.nav_end != null ? String(period.nav_end) : "")
  )

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Period frequency → divisor for annual rates
  const periodsPerYear: Record<string, number> = { daily: 365, weekly: 52, monthly: 12, quarterly: 4, "bi-annually": 2, annually: 1 }
  const periodDivisor = periodFrequency ? (periodsPerYear[periodFrequency] ?? 1) : 1

  // Compute effective fee rate for a share class fee rule
  function effectiveFeeRate(feeRule: { rate?: number | null; rate_is_annual?: boolean | null } | null | undefined): number {
    if (!feeRule?.rate) return 0
    const rate = feeRule.rate / 100
    return feeRule.rate_is_annual ? rate / periodDivisor : rate
  }

  // Fee breakdown preview: fetch positions when dialog opens
  type FeePreviewRow = { entryId: string; name: string; shares: number; scId: string | null }
  const [feePreviewRows, setFeePreviewRows] = React.useState<FeePreviewRow[]>([])

  // Fetch entity stats + positions once when dialog opens
  React.useEffect(() => {
    if (!open) return
    setStep(1)
    setError(null)
    // Load investor positions for fee preview
    Promise.all([
      fetch(`/api/cap-table-entries?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/fund-mutations?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []),
    ]).then(([entries, muts]) => {
      const sharesByEntry = new Map<string, number>()
      for (const m of muts as Array<{ cap_table_entry?: string; shares_issued?: number; shares_redeemed?: number }>) {
        if (!m.cap_table_entry) continue
        sharesByEntry.set(m.cap_table_entry, (sharesByEntry.get(m.cap_table_entry) ?? 0) + (m.shares_issued ?? 0) - (m.shares_redeemed ?? 0))
      }
      const rows: FeePreviewRow[] = []
      for (const e of entries as Array<{ id: string; share_class?: string | null; _shareholder?: { name?: string | null } | null }>) {
        const s = sharesByEntry.get(e.id) ?? 0
        if (s <= 0) continue
        rows.push({ entryId: e.id, name: e._shareholder?.name ?? "Investor", shares: s, scId: e.share_class ?? null })
      }
      setFeePreviewRows(rows)
    }).catch(() => setFeePreviewRows([]))
    if (suggestedClose) setClosedAt(suggestedClose)
    if (t.totalShares != null) setTotalSharesEnd(String(t.totalShares))
    if (t.grossNavPerShare != null) setGrossNav(String(t.grossNavPerShare))
    if (t.mgmtFeePerShare != null) setMgmtFeePerShareField(String(t.mgmtFeePerShare))
    if (t.mgmtFeeTotal != null) setMgmtFeeTotalField(String(t.mgmtFeeTotal))
    if (t.netNavPerShare != null) setNavEnd(String(t.netNavPerShare))
    // Pre-fill financial balances from tentative snapshot (live computed values)
    if (t.assetsValue != null) setTotalInvestedAssets(String(t.assetsValue))
    if (t.liabilitiesValue != null) setTotalDebt(String(t.liabilitiesValue))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Derived Step 1 values ───────────────────────────────────────────────────
  const investedNum = totalInvestedAssets ? Number(totalInvestedAssets) : null
  const debtNum = totalDebt ? Number(totalDebt) : 0
  const pnlNum = Number(pnlCosts) || 0
  const assetMinusLiabilities = investedNum != null ? investedNum - debtNum : null
  const totalAumEnd = assetMinusLiabilities != null ? assetMinusLiabilities - pnlNum : null
  const sharesEndNum = totalSharesEnd ? Number(totalSharesEnd) : null

  // ── Auto-derive Step 2 grossNav from Step 1 when advancing ─────────────────
  function handleNextStep() {
    setError(null)
    // Compute gross NAV from step 1 data if not overridden
    if (totalAumEnd != null && sharesEndNum != null && sharesEndNum > 0) {
      const derived = totalAumEnd / sharesEndNum
      setGrossNav(String(derived.toFixed(4)))
      // Derive net NAV = grossNav - mgmtFeePerShare
      const feePs = mgmtFeePerShareField ? Number(mgmtFeePerShareField) : (t.mgmtFeePerShare ?? 0)
      setNavEnd(String((derived - feePs).toFixed(4)))
    }
    setStep(2)
  }

  // ── Derived Step 2 values ───────────────────────────────────────────────────
  const grossNavValue = grossNav ? Number(grossNav) : null
  const navValue = navEnd ? Number(navEnd) : null
  const grossYield = grossNavValue != null && period.nav_start != null && period.nav_start > 0
    ? (grossNavValue - period.nav_start) / period.nav_start : null
  const netYield = navValue != null && period.nav_start != null && period.nav_start > 0
    ? (navValue - period.nav_start) / period.nav_start : null

  async function handleConfirm() {
    if (!navValue || navValue <= 0) { setError("Net NAV per share is required."); return }
    setSaving(true)
    setError(null)
    try {
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
          ...(mgmtFeePerShareField ? { management_fee_per_share: Number(mgmtFeePerShareField) } : {}),
          ...(mgmtFeeTotalField ? { management_fee_total: Number(mgmtFeeTotalField) } : {}),
          pnl_costs: pnlNum,
          ...(sharesEndNum != null ? { total_shares_end: sharesEndNum } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(investedNum != null ? {
            total_invested_assets: investedNum,
            total_debt: debtNum,
            total_aum_end: totalAumEnd,
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

      // Create fund_fee records per investor position.
      // fee_per_share is derived from grossNav × (rate / 100), adjusted for period frequency.
      if (grossNavValue != null && grossNavValue > 0) {
        try {
          const [posEntries, posMutations] = await Promise.all([
            fetch(`/api/cap-table-entries?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []),
            fetch(`/api/fund-mutations?entity=${entityUUID}`).then((r) => r.ok ? r.json() : []),
          ])
          const sharesByEntry = new Map<string, number>()
          for (const m of posMutations as Array<{ cap_table_entry?: string; shares_issued?: number; shares_redeemed?: number }>) {
            if (!m.cap_table_entry) continue
            const delta = (m.shares_issued ?? 0) - (m.shares_redeemed ?? 0)
            sharesByEntry.set(m.cap_table_entry, (sharesByEntry.get(m.cap_table_entry) ?? 0) + delta)
          }

          // Build fee rules per share class: fee_per_share = grossNav × effectiveRate
          const feeByClass = new Map<string, { feePerShare: number; feeId: string }>()
          for (const sc of shareClasses) {
            const mgmtFees = (sc._share_class_fee ?? []).filter((f) => f.type === "management")
            for (const f of mgmtFees) {
              const feePerShare = grossNavValue * effectiveFeeRate(f)
              if (feePerShare <= 0) continue
              feeByClass.set(sc.id, { feePerShare, feeId: f.id })
            }
          }
          // Fallback: single fee rule for entries without a share class
          const defaultFee = feeByClass.values().next().value ?? null

          const accruedAt = closedAt ? closedAt.getTime() : Date.now()
          const feePromises: Promise<unknown>[] = []

          for (const entry of posEntries as Array<{ id: string; share_class?: string | null }>) {
            const netShares = sharesByEntry.get(entry.id) ?? 0
            if (netShares <= 0) continue
            const classId = entry.share_class ?? shareClasses[0]?.id ?? null
            const rule = (classId ? feeByClass.get(classId) : null) ?? defaultFee
            if (!rule) continue
            const investorFee = netShares * rule.feePerShare
            feePromises.push(
              fetch("/api/fund-fees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  entity: entityUUID,
                  period: period.id,
                  share_class: classId,
                  share_class_fee: rule.feeId,
                  cap_table_entry: entry.id,
                  amount: investorFee,
                  fee_per_share: rule.feePerShare,
                  shares_outstanding: netShares,
                  status: "accrued",
                  accrued_at: accruedAt,
                }),
              })
            )
          }
          await Promise.all(feePromises)
        } catch {
          console.warn("[close-period] Failed to create some fund_fee records")
        }
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>Close period</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Step {step} of 2 — {step === 1 ? "Step B: Data from financials" : "Step C: Net NAV calculation"}
          </p>
        </DialogHeader>

        {/* ── Step 1: Data from Financials ─────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-3 py-1 overflow-y-auto -mx-4 px-4">
            <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
              Step B — Data from financials
            </p>

            <CcyField
              id="total-invested"
              label="Total invested assets end of period (cash + trades)"
              value={totalInvestedAssets}
              onChange={setTotalInvestedAssets}
              currencyCode={currencyCode}
            />
            <CcyField
              id="total-debt"
              label="Total debt end of period"
              value={totalDebt}
              onChange={setTotalDebt}
              currencyCode={currencyCode}
            />

            <ReadRow
              label="Asset minus liabilities end of period"
              value={assetMinusLiabilities != null ? fmtCcy(assetMinusLiabilities, currencyCode) : "—"}
            />

            <CcyField
              id="pnl-costs"
              label="Costs (manual)"
              value={pnlCosts}
              onChange={setPnlCosts}
              currencyCode={currencyCode}
              hint="Management fees are recorded automatically via Fund Fees"
            />

            <ReadRow
              label="Total AUM end of period"
              value={totalAumEnd != null
                ? <span className="text-base font-semibold">{fmtCcy(totalAumEnd, currencyCode)}</span>
                : "—"}
            />

            <div className="border-t pt-3 flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="shares-end">Total shares outstanding end of period</FieldLabel>
                <Input id="shares-end" type="number" min="0" step="0.0001" placeholder="0" value={totalSharesEnd} onChange={(e) => setTotalSharesEnd(e.target.value)} />
              </Field>
              <DatePickerInput id="closed-at" label="Closing date" value={closedAt} onChange={setClosedAt} />
              <Field>
                <FieldLabel htmlFor="period-notes">Notes</FieldLabel>
                <Input id="period-notes" placeholder="Optional…" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>

            {error && <FieldError>{error}</FieldError>}
          </div>
        )}

        {/* ── Step 2: Net NAV Calculation ───────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col gap-3 py-1 overflow-y-auto -mx-4 px-4">
            <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
              Step C — Net NAV calculation
            </p>

            <CcyField
              id="gross-nav"
              label="Gross end NAV for the period"
              value={grossNav}
              onChange={(v) => {
                setGrossNav(v)
                // Auto-update net NAV when gross changes
                const fee = mgmtFeePerShareField ? Number(mgmtFeePerShareField) : 0
                if (v && Number(v) > 0) setNavEnd(String((Number(v) - fee).toFixed(4)))
              }}
              hint={grossYield != null ? <>Gross yield: <span className={grossYield >= 0 ? "text-green-600" : "text-red-600"}>{fmtPct(grossYield)}</span></> : undefined}
              currencyCode={currencyCode}
            />

            <div className="grid grid-cols-2 gap-3">
              <CcyField
                id="mgmt-fee-per-share"
                label="Management fee/share"
                value={mgmtFeePerShareField}
                onChange={(v) => {
                  setMgmtFeePerShareField(v)
                  if (grossNav && Number(grossNav) > 0)
                    setNavEnd(String((Number(grossNav) - (v ? Number(v) : 0)).toFixed(4)))
                }}
                currencyCode={currencyCode}
              />
              <CcyField
                id="mgmt-fee-total"
                label="Management fee total"
                value={mgmtFeeTotalField}
                onChange={setMgmtFeeTotalField}
                currencyCode={currencyCode}
              />
            </div>

            {/* Fee breakdown preview (collapsible) */}
            {feePreviewRows.length > 0 && grossNavValue != null && grossNavValue > 0 && (
              <Accordion type="single" collapsible className="rounded-md border overflow-hidden text-xs">
                <AccordionItem value="fee-breakdown" className="border-b-0">
                  <AccordionTrigger className="bg-muted/30 px-3 py-1.5 font-semibold text-muted-foreground hover:no-underline rounded-none border-0">
                    Fee breakdown
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-muted border-y sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-1 font-medium text-muted-foreground">Investor</th>
                            <th className="text-right px-3 py-1 font-medium text-muted-foreground">Shares</th>
                            <th className="text-right px-3 py-1 font-medium text-muted-foreground">Fee/share</th>
                            <th className="text-right px-3 py-1 font-medium text-muted-foreground">Fee</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {feePreviewRows.map((row) => {
                            const classId = row.scId ?? shareClasses[0]?.id ?? null
                            const feeRule = classId
                              ? shareClasses.find((sc) => sc.id === classId)?._share_class_fee?.find((f) => f.type === "management")
                              : null
                            const feePerShare = grossNavValue * effectiveFeeRate(feeRule)
                            const feeAmount = row.shares * feePerShare
                            return (
                              <tr key={row.entryId}>
                                <td className="px-3 py-1.5">{row.name}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(row.shares, 4)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{fmtCcy(feePerShare, currencyCode)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums font-medium text-red-600">{fmtCcy(feeAmount, currencyCode)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="border-t bg-muted sticky bottom-0">
                          <tr>
                            <td className="px-3 py-1.5 font-semibold">Total</td>
                            <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fmt(feePreviewRows.reduce((s, r) => s + r.shares, 0), 4)}</td>
                            <td />
                            <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-red-600">
                              {fmtCcy(feePreviewRows.reduce((s, row) => {
                                const classId = row.scId ?? shareClasses[0]?.id ?? null
                                const feeRule = classId ? shareClasses.find((sc) => sc.id === classId)?._share_class_fee?.find((f) => f.type === "management") : null
                                return s + row.shares * grossNavValue * effectiveFeeRate(feeRule)
                              }, 0), currencyCode)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            <CcyField
              id="nav-end"
              label={<>Net NAV end of the period <span className="text-destructive">*</span></>}
              value={navEnd}
              onChange={setNavEnd}
              hint={netYield != null ? <>Net yield: <span className={netYield >= 0 ? "text-green-600" : "text-red-600"}>{fmtPct(netYield)}</span>{period.nav_start != null && navValue != null ? <> · {fmtCcy(period.nav_start, currencyCode)} → {fmtCcy(navValue, currencyCode)}</> : null}</> : undefined}
              currencyCode={currencyCode}
            />

            <div className="rounded-md border bg-muted/30 divide-y px-3">
              <ReadRow label="Total shares outstanding end of period" value={sharesEndNum != null ? fmt(sharesEndNum, 4) : "—"} />
              <ReadRow label="Total AUM end of period" value={totalAumEnd != null ? fmtCcy(totalAumEnd, currencyCode) : "—"} />
            </div>

            {error && <FieldError>{error}</FieldError>}
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={handleNextStep}>
                Next →
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setStep(1); setError(null) }} disabled={saving}>← Back</Button>
              <Button onClick={handleConfirm} disabled={saving || !navValue}>
                {saving ? <Spinner className="size-4 mr-2" /> : <Lock className="size-4 mr-2" />}
                Close period
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Period Card ──────────────────────────────────────────────────────────────

function PeriodCard({
  period,
  mutations,
  cumulativeMutations,
  shareClasses,
  entityUUID,
  currencyCode,
  onRefresh,
}: {
  period: FundPeriod
  mutations: FundMutation[]
  cumulativeMutations: FundMutation[]
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
  // Aggregate net shares per cap_table_entry across all mutations up to and including this period
  type InvestorRow = {
    entryId: string
    name: string | null
    email: string | null
    netShares: number
    totalIn: number   // amount_for_shares (subscriptions)
    totalOut: number  // amount_returned + amount_distributed
  }
  const investorMap = new Map<string, InvestorRow>()
  for (const m of cumulativeMutations) {
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

// ─── Distribution Step ────────────────────────────────────────────────────────

function DistributionStep({
  positions, shareClasses, lastNavEnd, currencyCode, entityUUID, existingDistributions, defaultDate, onDone, onSkip,
}: {
  positions: InvestorPosition[]
  shareClasses: ShareClass[]
  lastNavEnd: number | null
  currencyCode: string
  entityUUID: string
  existingDistributions?: Record<string, { amount: number; mutationId: string; payoutId: string }>
  defaultDate?: Date
  onDone: () => void
  onSkip: () => void
}) {
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [mutationAt, setMutationAt] = React.useState<Date | undefined>(defaultDate ?? new Date())
  // Track which entries already have recorded IDs (for PATCH vs POST)
  const [recordedIds, setRecordedIds] = React.useState<Record<string, { mutationId: string; payoutId: string }>>({})

  // Compute suggested amount from distribution schemes per investor.
  // If the investor's entry has no share_class link, fall back to the first
  // share class — matches typical single-class fund behaviour so suggestions
  // still populate even when per-entry class isn't assigned.
  const scMap = new Map(shareClasses.map((sc) => [sc.id, sc]))
  function computeSuggested(pos: InvestorPosition): number {
    // Positions with no shares can't receive a distribution, regardless of
    // historical committed amount or totalIn.
    if (pos.netShares <= 0.0001) return 0
    const sc = (pos.shareClass && scMap.get(pos.shareClass)) || shareClasses[0] || null
    const schemes = (sc?._share_class_distribution ?? []).filter((d) => d.enabled !== false)
    // For committed-capital-based schemes, fall back to the total amount subscribed
    // (totalIn) when committed_amount isn't set on the cap_table_entry.
    const committedBase = pos.committedAmount ?? pos.totalIn ?? 0
    let total = 0
    for (const s of schemes) {
      if (s.basis === "nav" && s.rate != null && lastNavEnd != null)
        total += (s.rate / 100) * pos.netShares * lastNavEnd
      else if (s.basis === "committed_capital" && s.rate != null && committedBase > 0)
        total += (s.rate / 100) * committedBase
      else if (s.basis === "fixed" && s.fixed_amount != null)
        total += s.fixed_amount * pos.netShares
    }
    return total
  }

  // Editable amounts (populated from scheme suggestions once positions + shareClasses load)
  const [amounts, setAmounts] = React.useState<Record<string, string>>({})

  // Fill suggestions whenever positions / shareClasses / nav data is available.
  // Only writes to empty slots, so user edits and existingDistributions are preserved.
  React.useEffect(() => {
    if (positions.length === 0 || shareClasses.length === 0) return
    setAmounts((prev) => {
      const next = { ...prev }
      let changed = false
      for (const pos of positions) {
        if (next[pos.entryId] != null && next[pos.entryId] !== "") continue
        const suggested = computeSuggested(pos)
        if (suggested > 0) {
          next[pos.entryId] = suggested.toFixed(2)
          changed = true
        }
      }
      return changed ? next : prev
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, shareClasses, lastNavEnd])

  // Sync from existingDistributions when it loads asynchronously
  React.useEffect(() => {
    if (!existingDistributions || Object.keys(existingDistributions).length === 0) return
    setAmounts((prev) => {
      const next = { ...prev }
      for (const [entryId, { amount }] of Object.entries(existingDistributions)) {
        next[entryId] = String(amount)
      }
      return next
    })
    setRecordedIds(Object.fromEntries(
      Object.entries(existingDistributions).map(([entryId, { mutationId, payoutId }]) => [entryId, { mutationId, payoutId }])
    ))
  }, [existingDistributions])

  const toSave = positions.filter((p) => amounts[p.entryId] && Number(amounts[p.entryId]) > 0)
  const allRecorded = positions.length > 0 && positions.every((p) => recordedIds[p.entryId] != null)

  async function handleAddDistributions() {
    if (toSave.length === 0) { onDone(); return }
    setSaving(true); setError(null)
    const declaredAt = mutationAt?.getTime() ?? Date.now()
    try {
      const newIds: Record<string, { mutationId: string; payoutId: string }> = {}
      await Promise.all(
        toSave.map(async (pos) => {
          const amount = Number(amounts[pos.entryId])
          const existing = recordedIds[pos.entryId]
          if (existing) {
            // PATCH existing mutation and payout
            await Promise.all([
              fetch(`/api/fund-mutations/${existing.mutationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount_distributed: amount }),
              }),
              fetch(`/api/fund-payouts/${existing.payoutId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount }),
              }),
            ])
            newIds[pos.entryId] = existing
          } else {
            // POST new mutation and payout
            const mutRes = await fetch("/api/fund-mutations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                entity: entityUUID,
                cap_table_entry: pos.entryId,
                type: "distribution",
                amount_distributed: amount,
                ...(lastNavEnd != null ? { nav_per_share: lastNavEnd } : {}),
                mutation_at: declaredAt,
              }),
            })
            if (!mutRes.ok) throw new Error("Failed to create mutation")
            const mutation: { id: string } = await mutRes.json()
            const payoutRes = await fetch("/api/fund-payouts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                entity: entityUUID,
                fund_mutation: mutation.id,
                cap_table_entry: pos.entryId,
                type: "distribution",
                amount,
                nav_at_declaration: lastNavEnd ?? null,
                status: "pending",
                declared_at: declaredAt,
              }),
            })
            if (!payoutRes.ok) throw new Error("Failed to create payout record")
            const payout: { id: string } = await payoutRes.json()
            newIds[pos.entryId] = { mutationId: mutation.id, payoutId: payout.id }
          }
        })
      )
      setRecordedIds((prev) => ({ ...prev, ...newIds }))
      onDone()
    } catch {
      setError("Failed to save distribution mutations.")
    } finally {
      setSaving(false)
    }
  }

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">No active investors to distribute to.</p>
        <Button variant="outline" size="sm" onClick={onSkip}>Skip distributions →</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b">
            <tr>
              <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Investor</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Shares</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Current value</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Distribution amount</th>
              <th className="text-right py-2 px-4 text-xs font-medium text-muted-foreground">Value after dist.</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const amount = amounts[pos.entryId] ? Number(amounts[pos.entryId]) : 0
              const currentValue = lastNavEnd != null ? pos.netShares * lastNavEnd : null
              const valueAfterDist = currentValue != null && amount > 0 ? currentValue - amount : currentValue
              return (
                <tr key={pos.entryId} className="border-b last:border-0">
                  <td className="py-2.5 px-4">
                    <div className="font-medium">{pos.name ?? "—"}</div>
                    {pos.email && <div className="text-xs text-muted-foreground">{pos.email}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{fmt(pos.netShares, 4)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {currentValue != null ? fmtCcy(currentValue, currencyCode) : "—"}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col items-end gap-0.5">
                      <Input
                        type="number" min="0" step="0.01" placeholder="0.00"
                        className="w-36 h-7 text-right text-sm"
                        value={amounts[pos.entryId] ?? ""}
                        onChange={(e) => setAmounts((prev) => ({ ...prev, [pos.entryId]: e.target.value }))}
                      />
                      {amount > 0 && (
                        <span className="text-[10px] text-blue-600 tabular-nums">−{fmtCcy(amount, currencyCode)}</span>
                      )}
                      {recordedIds[pos.entryId] != null && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                          <svg className="size-3" viewBox="0 0 12 12" fill="currentColor"><path d="M10 3L5 8.5 2 5.5l-.7.7L5 10l5.7-6.3z"/></svg>
                          Recorded
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                    {valueAfterDist != null ? fmtCcy(valueAfterDist, currencyCode) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {positions.length > 0 && (
            <tfoot className="border-t bg-muted/20">
              <tr>
                <td className="py-2 px-4 text-xs font-semibold">Total</td>
                <td className="py-2 px-3 text-right tabular-nums text-xs font-semibold">
                  {fmt(positions.reduce((s, p) => s + p.netShares, 0), 4)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-xs font-semibold">
                  {lastNavEnd != null ? fmtCcy(positions.reduce((s, p) => s + p.netShares * lastNavEnd, 0), currencyCode) : "—"}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-xs font-semibold text-blue-600">
                  {(() => {
                    const total = positions.reduce((s, p) => s + (amounts[p.entryId] ? Number(amounts[p.entryId]) : 0), 0)
                    return total > 0 ? `−${fmtCcy(total, currencyCode)}` : "—"
                  })()}
                </td>
                <td className="py-2 px-4 text-right tabular-nums text-xs font-semibold">
                  {lastNavEnd != null ? fmtCcy(positions.reduce((s, p) => {
                    const val = p.netShares * lastNavEnd
                    const dist = amounts[p.entryId] ? Number(amounts[p.entryId]) : 0
                    return s + (dist > 0 ? val - dist : val)
                  }, 0), currencyCode) : "—"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="flex items-end gap-4">
        <DatePickerInput id="dist-date" label="Distribution date" value={mutationAt} onChange={setMutationAt} />
      </div>
      {error && <FieldError>{error}</FieldError>}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onSkip} disabled={saving}>Skip distributions →</Button>
        <Button onClick={handleAddDistributions} disabled={saving}>
          {saving && <Spinner className="size-4 mr-2" />}
          {toSave.length === 0 ? "No distributions — Next →" : allRecorded ? `Update distributions (${toSave.length})` : `Save distributions (${toSave.length})`}
        </Button>
      </div>
    </div>
  )
}

// ─── Redemption Step ──────────────────────────────────────────────────────────

function RedemptionStep({
  positions, shareClasses, lastNavEnd, currencyCode, entityUUID, existingRedemptions, defaultDate, onDone, onSkip,
}: {
  positions: InvestorPosition[]
  shareClasses: ShareClass[]
  lastNavEnd: number | null
  currencyCode: string
  entityUUID: string
  existingRedemptions?: Array<{ entryId: string; name: string | null; email: string | null; sharesRedeemed: number; amount: number; mutationId: string; payoutId: string }>
  defaultDate?: Date
  onDone: () => void
  onSkip: () => void
}) {
  const [redemptions, setRedemptions] = React.useState<Record<string, string>>({})
  const [redemptionAmounts, setRedemptionAmounts] = React.useState<Record<string, string>>({})
  const [recordedIds, setRecordedIds] = React.useState<Record<string, { mutationId: string; payoutId: string }>>({})
  const [mutationAt, setMutationAt] = React.useState<Date | undefined>(defaultDate ?? new Date())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Sync from existingRedemptions when it loads asynchronously
  React.useEffect(() => {
    if (!existingRedemptions || existingRedemptions.length === 0) return
    setRedemptions((prev) => {
      const next = { ...prev }
      for (const r of existingRedemptions) {
        next[r.entryId] = String(r.sharesRedeemed)
      }
      return next
    })
    setRedemptionAmounts((prev) => {
      const next = { ...prev }
      for (const r of existingRedemptions) {
        next[r.entryId] = r.amount.toFixed(2)
      }
      return next
    })
    setRecordedIds(Object.fromEntries(
      existingRedemptions.map((r) => [r.entryId, { mutationId: r.mutationId, payoutId: r.payoutId }])
    ))
  }, [existingRedemptions])

  const scMap = React.useMemo(() => new Map(shareClasses.map((sc) => [sc.id, sc])), [shareClasses])
  const navForPosition = React.useCallback((pos: InvestorPosition) => {
    const sc = pos.shareClass ? scMap.get(pos.shareClass) : null
    return sc?.current_nav ?? lastNavEnd ?? 0
  }, [scMap, lastNavEnd])

  const toSave = positions.filter((p) => redemptions[p.entryId] && Number(redemptions[p.entryId]) > 0)

  async function handleRedemptions() {
    if (toSave.length === 0) { onDone(); return }
    setSaving(true); setError(null)
    const redeemedAt = mutationAt?.getTime() ?? Date.now()
    try {
      const newIds: Record<string, { mutationId: string; payoutId: string }> = {}
      await Promise.all(
        toSave.map(async (p) => {
          const nav = navForPosition(p)
          const shares = Number(redemptions[p.entryId])
          const amount = shares * nav
          const existing = recordedIds[p.entryId]
          if (existing) {
            await Promise.all([
              fetch(`/api/fund-mutations/${existing.mutationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shares_redeemed: shares, amount_returned: amount }),
              }),
              fetch(`/api/fund-payouts/${existing.payoutId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shares_redeemed: shares, amount }),
              }),
            ])
            newIds[p.entryId] = existing
          } else {
            const mutRes = await fetch("/api/fund-mutations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                entity: entityUUID, cap_table_entry: p.entryId, type: "redemption",
                shares_redeemed: shares, amount_returned: amount, nav_per_share: nav,
                mutation_at: redeemedAt,
              }),
            })
            if (!mutRes.ok) throw new Error("Failed to create mutation")
            const mutation: { id: string } = await mutRes.json()
            const payoutRes = await fetch("/api/fund-payouts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                entity: entityUUID, fund_mutation: mutation.id, cap_table_entry: p.entryId,
                type: "redemption", amount, nav_at_declaration: nav, shares_redeemed: shares,
                status: "pending", declared_at: redeemedAt,
              }),
            })
            if (!payoutRes.ok) throw new Error("Failed to create payout record")
            const payout: { id: string } = await payoutRes.json()
            newIds[p.entryId] = { mutationId: mutation.id, payoutId: payout.id }
          }
        })
      )
      setRecordedIds((prev) => ({ ...prev, ...newIds }))
      onDone()
    } catch {
      setError("Failed to save redemption mutations.")
    } finally {
      setSaving(false)
    }
  }

  // Build unified row list: active positions + fully-redeemed investors (not in positions)
  const existingRedemptionMap = React.useMemo(() => new Map((existingRedemptions ?? []).map((r) => [r.entryId, r])), [existingRedemptions])
  const activeEntryIds = React.useMemo(() => new Set(positions.map((p) => p.entryId)), [positions])
  const fullyRedeemedRows = (existingRedemptions ?? []).filter((r) => !activeEntryIds.has(r.entryId))
  const allRows = positions.length === 0 && fullyRedeemedRows.length === 0

  if (allRows) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">No active investors to redeem.</p>
        <Button variant="outline" size="sm" onClick={onSkip}>Skip redemptions →</Button>
      </div>
    )
  }

  // Footer totals — redemptions state is always pre-filled so no need to also sum existingRedemptions
  const totalActiveShares = positions.reduce((s, p) => s + p.netShares, 0)
  const totalActiveValue = positions.reduce((s, p) => s + p.netShares * navForPosition(p), 0)
  const totalRedeemedShares = positions.reduce((s, p) => s + (redemptions[p.entryId] ? Number(redemptions[p.entryId]) : 0), 0)
    + fullyRedeemedRows.reduce((s, r) => s + r.sharesRedeemed, 0)
  const totalRedeemedValue = positions.reduce((s, p) => {
    // Prefer the user-typed amount to avoid rounding drift from shares × nav
    const typedAmt = redemptionAmounts[p.entryId] ? Number(redemptionAmounts[p.entryId]) : NaN
    if (Number.isFinite(typedAmt) && typedAmt > 0) return s + typedAmt
    const sh = redemptions[p.entryId] ? Number(redemptions[p.entryId]) : 0
    return s + sh * navForPosition(p)
  }, 0)
    + fullyRedeemedRows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b">
            <tr>
              <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Investor</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Shares</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Current value</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Shares to redeem</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Amount to redeem</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Shares after red.</th>
              <th className="text-right py-2 px-4 text-xs font-medium text-muted-foreground">Value after red.</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const nav = navForPosition(p)
              const value = nav > 0 ? p.netShares * nav : null
              const isRecorded = !!recordedIds[p.entryId]
              const redeemedShares = redemptions[p.entryId] ? Number(redemptions[p.entryId]) : 0
              const sharesAfter = p.netShares - redeemedShares
              const valueAfter = nav > 0 ? sharesAfter * nav : null
              const redeemValue = redeemedShares > 0 ? redeemedShares * nav : null
              return (
                <tr key={p.entryId} className="border-b last:border-0">
                  <td className="py-2.5 px-4">
                    <div className="font-medium">{p.name ?? "—"}</div>
                    {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{fmt(p.netShares, 4)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{value != null ? fmtCcy(value, currencyCode) : "—"}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col items-end gap-0.5">
                      <Input
                        type="number" min="0" max={p.netShares} step="0.0001" placeholder="0"
                        className="w-32 h-7 text-right text-sm"
                        value={redemptions[p.entryId] ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value
                          setRedemptions((prev) => ({ ...prev, [p.entryId]: raw }))
                          const s = Number(raw)
                          setRedemptionAmounts((prev) => ({
                            ...prev,
                            [p.entryId]: raw === "" || !Number.isFinite(s) || s <= 0 || nav <= 0 ? "" : (s * nav).toFixed(2),
                          }))
                        }}
                      />
                      {isRecorded && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                          <svg className="size-3" viewBox="0 0 12 12" fill="currentColor"><path d="M10 3L5 8.5 2 5.5l-.7.7L5 10l5.7-6.3z"/></svg>
                          Recorded
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex justify-end">
                      <Input
                        type="number" min="0" max={nav > 0 ? p.netShares * nav : undefined} step="0.01" placeholder="0"
                        className="w-36 h-7 text-right text-sm"
                        disabled={nav <= 0}
                        value={redemptionAmounts[p.entryId] ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value
                          setRedemptionAmounts((prev) => ({ ...prev, [p.entryId]: raw }))
                          const amt = Number(raw)
                          setRedemptions((prev) => ({
                            ...prev,
                            [p.entryId]: raw === "" || !Number.isFinite(amt) || amt <= 0 || nav <= 0 ? "" : (amt / nav).toFixed(4),
                          }))
                        }}
                      />
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                    {redeemedShares > 0 ? fmt(sharesAfter, 4) : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                    {redeemedShares > 0 && valueAfter != null ? fmtCcy(valueAfter, currencyCode) : "—"}
                  </td>
                </tr>
              )
            })}
            {fullyRedeemedRows.map((r) => (
              <tr key={`recorded-${r.entryId}`} className="border-b last:border-0">
                <td className="py-2.5 px-4">
                  <div className="font-medium">{r.name ?? "—"}</div>
                  {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">—</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">—</td>
                <td className="py-2.5 px-3">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="tabular-nums font-medium text-sm">{fmt(r.sharesRedeemed, 4)}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                      <svg className="size-3" viewBox="0 0 12 12" fill="currentColor"><path d="M10 3L5 8.5 2 5.5l-.7.7L5 10l5.7-6.3z"/></svg>
                      Recorded
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums font-medium text-red-600">−{fmtCcy(r.amount, currencyCode)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums font-medium">0</td>
                <td className="py-2.5 px-4 text-right tabular-nums font-medium">{fmtCcy(0, currencyCode)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/20">
            <tr>
              <td className="py-2 px-4 text-xs font-semibold">Total</td>
              <td className="py-2 px-3 text-right text-xs tabular-nums font-semibold">{fmt(totalActiveShares, 4)}</td>
              <td className="py-2 px-3 text-right text-xs tabular-nums font-semibold">{fmtCcy(totalActiveValue, currencyCode)}</td>
              <td className="py-2 px-3 text-right text-xs tabular-nums font-semibold">
                {totalRedeemedShares > 0 ? fmt(totalRedeemedShares, 4) : "—"}
              </td>
              <td className="py-2 px-3 text-right text-xs tabular-nums font-semibold text-red-600">
                {totalRedeemedValue > 0 ? <>−{fmtCcy(totalRedeemedValue, currencyCode)}</> : "—"}
              </td>
              <td className="py-2 px-3 text-right text-xs tabular-nums font-semibold">
                {totalRedeemedShares > 0 ? fmt(totalActiveShares - totalRedeemedShares, 4) : "—"}
              </td>
              <td className="py-2 px-4 text-right text-xs tabular-nums font-semibold">
                {totalRedeemedShares > 0 ? fmtCcy(totalActiveValue - totalRedeemedValue, currencyCode) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex items-end gap-4">
        <DatePickerInput id="red-date" label="Redemption date" value={mutationAt} onChange={setMutationAt} />
      </div>
      {error && <FieldError>{error}</FieldError>}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onSkip} disabled={saving}>Skip redemptions →</Button>
        <Button onClick={handleRedemptions} disabled={saving}>
          {saving && <Spinner className="size-4 mr-2" />}
          {toSave.length === 0 ? "No redemptions — Next →" : Object.keys(recordedIds).length > 0 ? `Update redemptions (${toSave.length})` : `Save redemptions (${toSave.length})`}
        </Button>
      </div>
    </div>
  )
}

// ─── Open Period Step ─────────────────────────────────────────────────────────

function OpenPeriodStep({
  lastClosedPeriod, pendingMutations, existingDistributions, existingRedemptions, currencyCode, onOpenPeriod,
}: {
  lastClosedPeriod: FundPeriod | null
  pendingMutations: FundMutation[]
  existingDistributions: Record<string, { amount: number; mutationId: string; payoutId: string }>
  existingRedemptions: Array<{ entryId: string; name: string | null; sharesRedeemed: number; amount: number; mutationId: string; payoutId: string }>
  currencyCode: string
  onOpenPeriod: () => void
}) {
  const sharesEnd = lastClosedPeriod?.total_shares_end ?? null
  const grossNav = lastClosedPeriod?.nav_gross_end ?? lastClosedPeriod?.nav_end ?? null
  const aumEnd = lastClosedPeriod?.total_aum_end ?? (sharesEnd != null && grossNav != null ? sharesEnd * grossNav : null)

  const pendingSubs = pendingMutations.filter((m) => m.type === "subscription")
  const totalDistributed = Object.values(existingDistributions).reduce((s, v) => s + v.amount, 0)
  const totalRedeemedShares = existingRedemptions.reduce((s, r) => s + r.sharesRedeemed, 0)
  const totalRedeemedAmount = existingRedemptions.reduce((s, r) => s + r.amount, 0)
  const totalSubShares = pendingSubs.reduce((s, m) => s + (m.shares_issued ?? 0), 0)
  const totalSubAmount = pendingSubs.reduce((s, m) => s + (m.amount_for_shares ?? 0), 0)

  const newShares = sharesEnd != null ? sharesEnd - totalRedeemedShares + totalSubShares : null
  const newAum = aumEnd != null ? aumEnd - totalDistributed - totalRedeemedAmount + totalSubAmount : null

  const rows: Array<{ label: string; shares: number | null; amount: number | null; color?: string }> = [
    { label: `End of ${lastClosedPeriod?.label ?? "last period"}`, shares: sharesEnd, amount: aumEnd },
  ]
  if (totalDistributed > 0)
    rows.push({ label: "Distributions paid", shares: null, amount: -totalDistributed, color: "text-amber-600" })
  if (totalRedeemedShares > 0)
    rows.push({ label: `Redemptions (${existingRedemptions.length} investor${existingRedemptions.length !== 1 ? "s" : ""})`, shares: -totalRedeemedShares, amount: -totalRedeemedAmount, color: "text-red-600" })
  if (totalSubShares > 0)
    rows.push({ label: `New subscriptions (${pendingSubs.length} investor${pendingSubs.length !== 1 ? "s" : ""})`, shares: totalSubShares, amount: totalSubAmount, color: "text-emerald-600" })

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b">
            <tr>
              <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Item</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Shares</th>
              <th className="text-right py-2 px-4 text-xs font-medium text-muted-foreground">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className={["py-2.5 px-4 font-medium", row.color ?? ""].join(" ")}>{row.label}</td>
                <td className={["py-2.5 px-3 text-right tabular-nums", row.color ?? "text-foreground"].join(" ")}>
                  {row.shares != null ? (row.shares >= 0 ? fmt(row.shares, 4) : `−${fmt(Math.abs(row.shares), 4)}`) : "—"}
                </td>
                <td className={["py-2.5 px-4 text-right tabular-nums", row.color ?? "text-foreground"].join(" ")}>
                  {row.amount != null ? (row.amount >= 0 ? fmtCcy(row.amount, currencyCode) : `−${fmtCcy(Math.abs(row.amount), currencyCode)}`) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/20">
            <tr>
              <td className="py-2.5 px-4 text-sm font-semibold">Opening position</td>
              <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                {newShares != null ? fmt(newShares, 4) : "—"}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums font-semibold">
                {newAum != null ? fmtCcy(newAum, currencyCode) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {(totalDistributed === 0 && totalRedeemedShares === 0 && totalSubShares === 0) && (
        <p className="text-xs text-muted-foreground text-center">No mutations recorded — opening period from last period values.</p>
      )}
      <div className="flex justify-end">
        <Button onClick={onOpenPeriod}>
          <Plus className="size-3.5 mr-1.5" />
          Open period
        </Button>
      </div>
    </div>
  )
}

// ─── Mutation Workflow ────────────────────────────────────────────────────────

function MutationWorkflow({
  entityUUID, currencyCode, lastClosedPeriod, allMutations, pendingMutations,
  shareClasses, capTableEntries, executedTransfers, undeployedCalls, onRefresh, onOpenPeriod,
}: {
  entityUUID: string
  currencyCode: string
  lastClosedPeriod: FundPeriod | null
  allMutations: FundMutation[]
  pendingMutations: FundMutation[]
  shareClasses: ShareClass[]
  capTableEntries: CapTableEntry[]
  executedTransfers: Array<{
    id: string
    seller_cap_table_entry?: string | null
    buyer_cap_table_entry?: string | null
    seller_mutation?: string | null
    buyer_mutation?: string | null
    shares?: number | null
    status?: string | null
  }>
  undeployedCalls: Array<{ call: CapitalCall; entry: CapTableEntry }>
  onRefresh: () => void
  onOpenPeriod: () => void
}) {
  const scMap = React.useMemo(() => new Map(shareClasses.map((sc) => [sc.id, sc])), [shareClasses])
  const [activeStep, setActiveStep] = React.useState<1 | 2 | 3 | 4>(1)
  const [step1Done, setStep1Done] = React.useState(false)
  const [step2Done, setStep2Done] = React.useState(false)
  const [step3Done, setStep3Done] = React.useState(false)
  const [deployCall, setDeployCall] = React.useState<{ call: CapitalCall; entry: CapTableEntry } | null>(null)
  const [subscribeAllOpen, setSubscribeAllOpen] = React.useState(false)
  const [editMutation, setEditMutation] = React.useState<FundMutation | null>(null)
  type ExistingDist = { amount: number; mutationId: string; payoutId: string }
  type ExistingRed = { entryId: string; name: string | null; email: string | null; sharesRedeemed: number; amount: number; mutationId: string; payoutId: string }
  const [existingDistributions, setExistingDistributions] = React.useState<Record<string, ExistingDist>>({})
  const [existingRedemptions, setExistingRedemptions] = React.useState<ExistingRed[]>([])

  const lastNavEnd = lastClosedPeriod?.nav_end ?? null

  // Smart default mutation date = day after last period closed (or today)
  const defaultMutationDate = React.useMemo(() => {
    if (lastClosedPeriod?.closed_at) {
      const d = new Date(lastClosedPeriod.closed_at)
      d.setDate(d.getDate() + 1)
      return d
    }
    return new Date()
  }, [lastClosedPeriod?.closed_at])

  const positions = React.useMemo(
    () => computeCurrentPositions(allMutations, capTableEntries, executedTransfers),
    [allMutations, capTableEntries, executedTransfers]
  )

  // On mount, check for existing pending payouts — pre-populate recorded state
  // Only include payouts linked to mutations in the current pending workflow (not prior periods)
  const pendingMutationIds = React.useMemo(
    () => new Set(pendingMutations.map((m) => m.id)),
    [pendingMutations]
  )

  React.useEffect(() => {
    fetch(`/api/fund-payouts?entity=${entityUUID}&status=pending`)
      .then((r) => r.ok ? r.json() : [])
      .then((payouts: Array<{
        id?: string | null
        fund_mutation?: string | null
        cap_table_entry?: string | null
        amount?: number | null
        type?: string | null
        shares_redeemed?: number | null
        _cap_table_entry?: { _shareholder?: { name?: string | null; email?: string | null } | null } | null
      }>) => {
        const distMap: Record<string, ExistingDist> = {}
        const redemptionList: ExistingRed[] = []
        for (const p of payouts) {
          if (!p.id || !p.fund_mutation || !p.cap_table_entry) continue
          // Only consider payouts tied to the current pending mutations cycle
          if (!pendingMutationIds.has(p.fund_mutation)) continue
          if (p.type === "distribution" && p.amount != null) {
            distMap[p.cap_table_entry] = { amount: p.amount, mutationId: p.fund_mutation, payoutId: p.id }
          } else if (p.type === "redemption" && p.amount != null) {
            redemptionList.push({
              entryId: p.cap_table_entry,
              name: p._cap_table_entry?._shareholder?.name ?? null,
              email: p._cap_table_entry?._shareholder?.email ?? null,
              sharesRedeemed: p.shares_redeemed ?? 0,
              amount: p.amount,
              mutationId: p.fund_mutation,
              payoutId: p.id,
            })
          }
        }
        setExistingDistributions(distMap)
        setExistingRedemptions(redemptionList)
        if (redemptionList.length > 0) {
          setStep2Done(true)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityUUID, pendingMutationIds])

  // Auto-advance past step 1 once we know all positions are covered by existing payouts
  React.useEffect(() => {
    if (positions.length > 0 && positions.every((pos) => existingDistributions[pos.entryId]?.amount != null)) {
      setStep1Done(true)
      setActiveStep((prev) => (prev === 1 ? 2 : prev))
    }
  }, [existingDistributions, positions])

  const pendingSubs = pendingMutations.filter((m) => m.type === "subscription")

  if (capTableEntries.length === 0) {
    return (
      <div className="rounded-xl border p-6 flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-medium">No investors yet</p>
        <p className="text-xs text-muted-foreground">Add investors to your fund before opening a period.</p>
      </div>
    )
  }

  const steps = [
    { id: 1 as const, label: "Distributions", done: step1Done },
    { id: 2 as const, label: "Redemptions", done: step2Done },
    { id: 3 as const, label: "Subscriptions", done: step3Done },
    { id: 4 as const, label: "Open period" },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Step tabs */}
      <div className="flex rounded-lg border overflow-hidden text-sm">
        {steps.map((s, i) => {
          const isActive = activeStep === s.id
          const isDisabled = (s.id === 2 && !step1Done) || (s.id === 3 && !step2Done) || (s.id === 4 && !step3Done)
          const isDone = s.id === 1 ? step1Done : s.id === 2 ? step2Done : s.id === 3 ? step3Done : false
          return (
            <button
              key={s.id}
              disabled={isDisabled}
              onClick={() => { if (!isDisabled) setActiveStep(s.id) }}
              className={[
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors",
                i > 0 ? "border-l" : "",
                isActive ? "bg-foreground text-background" : "bg-background text-foreground hover:bg-muted/50",
                isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              <span className={[
                "inline-flex items-center justify-center size-5 rounded-full text-xs font-bold shrink-0",
                isDone ? "bg-emerald-500 text-white" : isActive ? "bg-background/20 text-inherit" : "bg-muted text-muted-foreground",
              ].join(" ")}>
                {isDone ? "✓" : s.id}
              </span>
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Step content */}
      <div className="min-h-45">
        {activeStep === 1 && (
          <DistributionStep
            positions={positions}
            shareClasses={shareClasses}
            lastNavEnd={lastNavEnd}
            currencyCode={currencyCode}
            entityUUID={entityUUID}
            existingDistributions={existingDistributions}
            defaultDate={defaultMutationDate}
            onDone={() => { onRefresh(); setStep1Done(true); setActiveStep(2) }}
            onSkip={() => { setStep1Done(true); setActiveStep(2) }}
          />
        )}

        {activeStep === 2 && (
          <RedemptionStep
            positions={positions}
            shareClasses={shareClasses}
            lastNavEnd={lastNavEnd}
            currencyCode={currencyCode}
            entityUUID={entityUUID}
            existingRedemptions={existingRedemptions}
            defaultDate={defaultMutationDate}
            onDone={() => { onRefresh(); setStep2Done(true); setActiveStep(3) }}
            onSkip={() => { setStep2Done(true); setActiveStep(3) }}
          />
        )}

        {activeStep === 3 && (
          <div className="flex flex-col gap-4">
            {/* Subscriptions content — no Open period button here */}
            {undeployedCalls.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Pending capital</h3>
                    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-medium">
                      {undeployedCalls.length}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSubscribeAllOpen(true)}>
                    Subscribe all
                  </Button>
                </div>
                <div className="rounded-xl border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b">
                      <tr>
                        <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">Investor</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Share class</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Paid</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Amount</th>
                        <th className="py-2 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {undeployedCalls.map(({ call, entry }) => {
                        // Prefer the cap_table_entry's share_class (set at subscription time),
                        // fall back to whatever is on the capital call itself.
                        const scId = entry.share_class ?? call.share_class ?? null
                        const scName = (scId && scMap.get(scId)?.name) ?? call._share_class?.name ?? "—"
                        return (
                        <tr key={call.id} className="border-b last:border-0">
                          <td className="py-2.5 px-4">
                            <div className="font-medium">{entry._shareholder?.name ?? "—"}</div>
                            {entry._shareholder?.email && <div className="text-xs text-muted-foreground">{entry._shareholder.email}</div>}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{scName}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{fmtDate(call.received_at)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-medium">{fmtCcy(call.amount, currencyCode)}</td>
                          <td className="py-2.5 px-4 text-right">
                            <Button size="sm" variant="outline" onClick={() => setDeployCall({ call, entry })}>
                              Subscribe
                            </Button>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {pendingSubs.length > 0 && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b">
                  <span className="text-sm font-semibold">Pending subscriptions</span>
                  <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[11px] font-medium">
                    {pendingSubs.length}
                  </span>
                </div>
                {(() => {
                  const totalIn = pendingSubs.reduce((s, m) => s + (m.amount_for_shares ?? 0), 0)
                  const totalShares = pendingSubs.reduce((s, m) => s + (m.shares_issued ?? 0), 0)
                  return (
                    <MutationRows
                      mutations={pendingSubs}
                      currencyCode={currencyCode}
                      onEdit={(m) => setEditMutation(m)}
                      onDelete={async (m) => {
                        if (!confirm("Delete this pending subscription?")) return
                        await fetch(`/api/fund-mutations/${m.id}`, { method: "DELETE" })
                        onRefresh()
                      }}
                      footer={
                        <tfoot className="border-t bg-muted/20">
                          <tr>
                            <td className="py-2 px-4 text-xs font-semibold">Total</td>
                            <td /><td /><td />
                            <td className="py-2 px-3 text-right tabular-nums text-xs font-semibold">{fmtCcy(totalIn, currencyCode)}</td>
                            <td className="py-2 px-4 text-right tabular-nums text-xs font-semibold">{fmt(totalShares, 4)}</td>
                          </tr>
                        </tfoot>
                      }
                    />
                  )
                })()}
              </div>
            )}

            {undeployedCalls.length === 0 && pendingSubs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-sm text-muted-foreground">No pending subscriptions.</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => { setStep3Done(true); setActiveStep(4) }}>Skip subscriptions →</Button>
              <Button onClick={() => { setStep3Done(true); setActiveStep(4) }}>
                {pendingSubs.length > 0 ? "Review & open period →" : "Next →"}
              </Button>
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <OpenPeriodStep
            lastClosedPeriod={lastClosedPeriod}
            pendingMutations={pendingMutations}
            existingDistributions={existingDistributions}
            existingRedemptions={existingRedemptions}
            currencyCode={currencyCode}
            onOpenPeriod={onOpenPeriod}
          />
        )}
      </div>

      {deployCall && (
        <DeployCallDialog
          open
          onClose={() => setDeployCall(null)}
          entityUUID={entityUUID}
          call={deployCall.call}
          entry={deployCall.entry}
          openPeriod={null}
          previousPeriod={lastClosedPeriod}
          currencyCode={currencyCode}
          onSuccess={() => { setDeployCall(null); onRefresh() }}
        />
      )}
      <SubscribeAllDialog
        open={subscribeAllOpen}
        onClose={() => setSubscribeAllOpen(false)}
        entityUUID={entityUUID}
        calls={undeployedCalls}
        openPeriod={null}
        previousPeriod={lastClosedPeriod}
        currencyCode={currencyCode}
        onSuccess={() => { setSubscribeAllOpen(false); onRefresh() }}
      />

      <EditMutationDialog
        open={!!editMutation}
        onClose={() => setEditMutation(null)}
        mutation={editMutation}
        currencyCode={currencyCode}
        onSaved={() => { setEditMutation(null); onRefresh() }}
      />
    </div>
  )
}

// ─── Edit Mutation Dialog ────────────────────────────────────────────────────

function EditMutationDialog({
  open,
  onClose,
  mutation,
  currencyCode,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  mutation: FundMutation | null
  currencyCode: string
  onSaved: () => void
}) {
  const [navPerShare, setNavPerShare] = React.useState("")
  const [amountInvested, setAmountInvested] = React.useState("")
  const [mutationAt, setMutationAt] = React.useState<Date | undefined>()
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open && mutation) {
      setNavPerShare(mutation.nav_per_share != null ? String(mutation.nav_per_share) : "")
      setAmountInvested(mutation.amount_invested != null ? String(mutation.amount_invested) : (mutation.amount_for_shares != null ? String(mutation.amount_for_shares) : ""))
      setMutationAt(mutation.mutation_at ? new Date(mutation.mutation_at) : new Date())
      setError(null)
    }
  }, [open, mutation])

  const nav = parseFloat(navPerShare) || 0
  const amount = parseFloat(amountInvested) || 0
  const sharesIssued = nav > 0 && amount > 0 ? amount / nav : 0

  async function handleSave() {
    if (!mutation) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/fund-mutations/${mutation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nav_per_share: nav,
          amount_invested: amount,
          amount_for_shares: amount,
          shares_issued: sharesIssued,
          mutation_at: mutationAt ? mutationAt.getTime() : Date.now(),
        }),
      })
      if (!res.ok) throw new Error("Failed to save")
      onSaved()
    } catch {
      setError("Failed to save mutation.")
    } finally {
      setSaving(false)
    }
  }

  const investor = mutation?._cap_table_entry?._shareholder

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit subscription</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          {investor && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Investor</span>
                <span className="font-medium">{investor.name ?? "—"}</span>
              </div>
            </div>
          )}
          <Field>
            <FieldLabel>NAV per share</FieldLabel>
            <Input type="number" min="0" step="0.0001" value={navPerShare} onChange={(e) => setNavPerShare(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Amount ({currencyCode})</FieldLabel>
            <Input type="number" min="0" step="0.01" value={amountInvested} onChange={(e) => setAmountInvested(e.target.value)} />
          </Field>
          <DatePickerInput id="edit-mut-date" label="Date" value={mutationAt} onChange={setMutationAt} />
          {nav > 0 && amount > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Shares</span>
                <span className="font-medium tabular-nums">{fmt(sharesIssued, 4)}</span>
              </div>
            </div>
          )}
          {error && <FieldError>{error}</FieldError>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving || nav <= 0 || amount <= 0} onClick={handleSave}>
            {saving ? <Spinner className="size-4" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [periods, setPeriods] = React.useState<FundPeriod[]>([])
  const [allMutations, setAllMutations] = React.useState<FundMutation[]>([])
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([])
  const [capTableEntries, setCapTableEntries] = React.useState<CapTableEntry[]>([])
  type ShareTransferRec = {
    id: string
    seller_cap_table_entry?: string | null
    buyer_cap_table_entry?: string | null
    seller_mutation?: string | null
    buyer_mutation?: string | null
    shares?: number | null
    status?: "pending" | "executed" | "reversed" | null
  }
  const [shareTransfers, setShareTransfers] = React.useState<ShareTransferRec[]>([])
  const [loading, setLoading] = React.useState(true)
  const [openPeriodDialogOpen, setOpenPeriodDialogOpen] = React.useState(false)
  const [addMutationOpen, setAddMutationOpen] = React.useState(false)

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [periodsRes, mutationsRes, sc, entries, executedTransfers] = await Promise.all([
        fetch(`/api/fund-periods?entity=${entityUUID}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
        fetch(`/api/fund-mutations?entity=${entityUUID}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
        fetchShareClasses(entityUUID),
        fetchCapTableEntries(entityUUID),
        fetch(`/api/share-transfers?entity=${entityUUID}&status=executed`, { cache: "no-store" })
          .then((r) => r.ok ? r.json() : []).catch(() => []),
      ])
      setPeriods((periodsRes as FundPeriod[]).sort((a, b) => (b.opened_at ?? 0) - (a.opened_at ?? 0)))
      setAllMutations(mutationsRes as FundMutation[])
      setShareClasses(sc)
      setCapTableEntries(entries)
      setShareTransfers(Array.isArray(executedTransfers) ? (executedTransfers as ShareTransferRec[]) : [])
      window.dispatchEvent(new CustomEvent("ledger:update"))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [entityUUID])

  const silentLoad = React.useCallback(() => { void load(true) }, [load])

  React.useEffect(() => { void load() }, [load])

  const openPeriod = periods.find((p) => p.status === "open") ?? null
  const closedPeriods = periods.filter((p) => p.status === "closed")
  const lastClosedPeriod = closedPeriods[0] ?? null

  // Flatten undeployed capital calls across all cap table entries
  const undeployedCalls = React.useMemo(() => {
    const result: Array<{ call: CapitalCall; entry: CapTableEntry }> = []
    for (const entry of capTableEntries) {
      for (const call of entry._capital_call ?? []) {
        if (call.deployed_at == null) result.push({ call, entry })
      }
    }
    return result
  }, [capTableEntries])

  // Capital received into the fund bank account but not yet processed as a subscription mutation.
  // This cash appears in entity stats but should not count toward the current period's NAV.
  const receivedUndeployedTotal = React.useMemo(
    () => undeployedCalls
      .filter(({ call }) => call.received_at != null)
      .reduce((s, { call }) => s + (call.amount ?? 0), 0),
    [undeployedCalls]
  )

  // Mutations not yet assigned to any period
  const pendingMutations = React.useMemo(
    () => allMutations.filter((m) => !m.period),
    [allMutations]
  )

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
          priorPeriods={closedPeriods}
          periodFrequency={periodFrequency}
          receivedUndeployedTotal={receivedUndeployedTotal}
          onRefresh={load}
        />
      )}

      {/* ── Mutation workflow (no open period) ───────────────────────────── */}
      {!openPeriod && (
        <MutationWorkflow
          entityUUID={entityUUID}
          currencyCode={currencyCode}
          lastClosedPeriod={lastClosedPeriod}
          allMutations={allMutations}
          pendingMutations={pendingMutations}
          shareClasses={shareClasses}
          capTableEntries={capTableEntries}
          executedTransfers={shareTransfers}
          undeployedCalls={undeployedCalls}
          onRefresh={silentLoad}
          onOpenPeriod={() => setOpenPeriodDialogOpen(true)}
        />
      )}

      {/* ── Closed periods ────────────────────────────────────────────────── */}
      {closedPeriods.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Closed periods</h2>
          {closedPeriods.map((p, idx) => {
            // Cumulative = this period + all older closed periods (array is newest-first)
            const cumulativePeriodIds = new Set(closedPeriods.slice(idx).map((cp) => cp.id))
            const cumulativeMutations = allMutations.filter(
              (m) => m.period && cumulativePeriodIds.has(m.period)
            )
            return (
              <PeriodCard
                key={p.id}
                period={p}
                mutations={mutsByPeriod.get(p.id) ?? []}
                cumulativeMutations={cumulativeMutations}
                shareClasses={shareClasses}
                entityUUID={entityUUID}
                currencyCode={currencyCode}
                onRefresh={load}
              />
            )
          })}
        </div>
      )}

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <OpenPeriodDialog
        open={openPeriodDialogOpen}
        onClose={() => setOpenPeriodDialogOpen(false)}
        entityUUID={entityUUID}
        previousPeriod={lastClosedPeriod}
        pendingMutations={pendingMutations}
        currencyCode={currencyCode}
        periodFrequency={periodFrequency}
        onSuccess={() => { setOpenPeriodDialogOpen(false); void load() }}
      />

      {openPeriod && (
        <AddMutationDialog
          open={addMutationOpen}
          onClose={() => setAddMutationOpen(false)}
          entityUUID={entityUUID}
          periodId={openPeriod.id}
          onSuccess={() => { setAddMutationOpen(false); void load() }}
        />
      )}

    </div>
  )
}
