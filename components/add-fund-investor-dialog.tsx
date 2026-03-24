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
import { AlertCircle, Info } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import type { ShareClass } from "@/lib/cap-table"

// ─── Types ────────────────────────────────────────────────────────────────────

type CurrencyOption = { id: number; name?: string | null; code?: string | null }
type FundOption = { id: string; name?: string | null; entity?: string | null }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCcy(n: number, code: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(n)
  } catch {
    return String(n)
  }
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

export function AddFundInvestorDialog({
  open,
  onClose,
  fundId,
  fundEntityUUID,
  amEntityUUID,
  amRecordId,
  shareClasses,
  currencyCode,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  fundId?: string
  fundEntityUUID: string
  amEntityUUID: string | null
  amRecordId?: string | null
  shareClasses: ShareClass[]
  currencyCode: string
  onSuccess: () => void
}) {
  // ── Investor ──
  const [email, setEmail] = React.useState("")
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<string>("individual")

  // ── Fund-as-investor ──
  const [amFunds, setAmFunds] = React.useState<FundOption[]>([])
  const [selectedFundId, setSelectedFundId] = React.useState("")

  // ── Investment ──
  const [shareClassId, setShareClassId] = React.useState("")
  const [committedAmount, setCommittedAmount] = React.useState("")

  // ── Currency ──
  const [currencies, setCurrencies] = React.useState<CurrencyOption[]>([])
  const [currencyId, setCurrencyId] = React.useState<number | null>(null)

  // ── Subscription record mode ──
  // "none" = no call, "pending" = standard flow (notifies), "paid" = bypass (already received)
  const [recordMode, setRecordMode] = React.useState<"none" | "pending" | "paid">("paid")
  const [subscriptionDate, setSubscriptionDate] = React.useState<Date | undefined>(new Date())
  const [callAmount, setCallAmount] = React.useState("")
  const [entryFeeRate, setEntryFeeRate] = React.useState("")  // as percent, e.g. "2"
  const [markDeployed, setMarkDeployed] = React.useState(false)

  // ── Submit ──
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Load currencies once on mount
  React.useEffect(() => {
    fetch("/api/currencies")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: CurrencyOption[]) => {
        setCurrencies(list)
        const match = list.find((c) => c.code === currencyCode)
        if (match) setCurrencyId(match.id)
      })
      .catch(() => {})
  }, [currencyCode])

  // Load sibling funds when AM is known (for fund-as-investor)
  // managed_by stores the asset_manager record UUID (amRecordId), not entity UUID
  React.useEffect(() => {
    const managedBy = amRecordId ?? amEntityUUID
    if (!managedBy) return
    fetch(`/api/funds?managed_by=${managedBy}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: FundOption[]) => setAmFunds(list.filter((f) => f.entity !== fundEntityUUID)))
      .catch(() => {})
  }, [amRecordId, amEntityUUID, fundEntityUUID])

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setEmail(""); setName(""); setType("individual"); setSelectedFundId("")
      setShareClassId(""); setCommittedAmount("")
      setRecordMode("paid"); setSubscriptionDate(new Date()); setCallAmount(""); setEntryFeeRate(""); setMarkDeployed(false)
      setError(null)
      const match = currencies.find((c) => c.code === currencyCode)
      setCurrencyId(match?.id ?? null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill name when a sibling fund is selected
  React.useEffect(() => {
    if (type === "fund" && selectedFundId) {
      const f = amFunds.find((f) => f.id === selectedFundId)
      if (f?.name) setName(f.name)
    }
  }, [selectedFundId, type, amFunds])

  // Auto-populate entry fee from selected share class fees
  React.useEffect(() => {
    if (!shareClassId) { setEntryFeeRate(""); return }
    const sc = shareClasses.find((s) => s.id === shareClassId)
    const fee = sc?._share_class_fee?.find((f) => f.type === "entry")
    setEntryFeeRate(fee?.rate != null ? String(fee.rate * 100) : "")
  }, [shareClassId, shareClasses])

  // Sync committed → call amount (first time only)
  React.useEffect(() => {
    if (callAmount === "" && committedAmount) setCallAmount(committedAmount)
  }, [committedAmount])

  // Derived
  const sc = shareClasses.find((s) => s.id === shareClassId)
  const selectedCurrency = currencies.find((c) => c.id === currencyId)
  const displayCode = selectedCurrency?.code ?? currencyCode
  // netAmount = what goes into the fund for shares (the entered field value)
  const netAmount = callAmount ? Number(callAmount) : null
  const feeRateDecimal = entryFeeRate ? Number(entryFeeRate) / 100 : 0
  // feeAmount is additive on top of net; grossWire = what investor actually sends
  const feeAmount = netAmount != null ? netAmount * feeRateDecimal : 0
  const grossWire = netAmount != null ? netAmount + feeAmount : null
  const sharesIssued = netAmount != null && sc?.current_nav ? netAmount / sc.current_nav : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Investor name is required."); return }
    setSaving(true)
    setError(null)

    try {
      // Fund-as-investor: shareholder record only, no entry or call
      if (type === "fund") {
        if (!selectedFundId) { setError("Select the investing fund."); setSaving(false); return }
        await fetch("/api/cap-table-shareholders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: fundEntityUUID,
            name: name.trim(),
            type: "fund",
            linked_fund: selectedFundId,
            role: "investor",
          }),
        })
        onSuccess()
        onClose()
        return
      }

      // Paid/bypass mode: single server-side endpoint handles the full chain
      if (recordMode === "paid" && netAmount && amEntityUUID) {
        const entryFee = sc?._share_class_fee?.find((f) => f.type === "entry")
        const res = await fetch("/api/fund-bypass-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim() || undefined,
            name: name.trim(),
            type,
            fundEntityUUID,
            amEntityUUID,
            shareClassId: shareClassId || undefined,
            shareClassFeeId: entryFee?.id || undefined,
            committedAmount: committedAmount ? Number(committedAmount) : undefined,
            callAmount: netAmount,
            subscriptionDate: subscriptionDate ? subscriptionDate.getTime() : Date.now(),
            entryFeeRateDecimal: feeRateDecimal,
            markDeployed,
            currencyId: currencyId ?? undefined,
            fundId: fundId ?? undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(err.error ?? "Failed to record subscription")
        }
        onSuccess()
        onClose()
        return
      }

      // Cap-table-only or standard pending call flow ─────────────────────────

      // 1. Get or create AM-level shareholder
      let amShareholderId: string | null = null
      if (amEntityUUID) {
        const r = await fetch("/api/cap-table-shareholders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity: amEntityUUID, name: name.trim(), email: email.trim() || null, type, role: "investor" }),
        })
        if (!r.ok) throw new Error("Failed to create investor in asset manager")
        const d: { id: string } = await r.json()
        amShareholderId = d.id
      }

      // 2. Create fund-level shareholder
      const fundShRes = await fetch("/api/cap-table-shareholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: fundEntityUUID, name: name.trim(), email: email.trim() || null, type, role: "investor" }),
      })
      if (!fundShRes.ok) throw new Error("Failed to create investor in fund")
      const fundSh: { id: string } = await fundShRes.json()

      // 3. Link fund shareholder → AM shareholder via parent_shareholder
      if (amShareholderId) {
        await fetch(`/api/cap-table-shareholders/${fundSh.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_shareholder: amShareholderId }),
        })
      }

      // 4. Create cap_table_entry for the fund
      const entryRes = await fetch("/api/cap-table-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: fundEntityUUID,
          shareholder: fundSh.id,
          share_class: shareClassId || null,
          committed_amount: committedAmount ? Number(committedAmount) : null,
          issued_at: subscriptionDate ? subscriptionDate.getTime() : Date.now(),
        }),
      })
      if (!entryRes.ok) throw new Error("Failed to create cap table entry")
      const entry: { id: string } = await entryRes.json()

      // 5. Create capital call for pending flow (notifies investor)
      if (recordMode === "pending" && netAmount) {
        const callTs = subscriptionDate ? subscriptionDate.getTime() : Date.now()
        const callRes = await fetch("/api/capital-calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: fundEntityUUID,
            cap_table_entry: entry.id,
            amount: netAmount,
            called_at: callTs,
            status: "pending",
          }),
        })
        if (!callRes.ok) throw new Error("Failed to create capital call")
        const call: { id: string } = await callRes.json()
        if (shareClassId) {
          await fetch(`/api/capital-calls/${call.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ share_class: shareClassId }),
          })
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add investor to fund</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Directly onboard an investor — they will also appear in the asset manager investor list.
            </p>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-5">

            {/* ── INVESTOR ── */}
            <section className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Investor</p>

              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select value={type} onValueChange={(v) => { setType(v); setSelectedFundId(""); setName("") }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="fund">Fund</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {type === "fund" ? (
                <>
                  <Field>
                    <FieldLabel>Investing fund</FieldLabel>
                    <Select value={selectedFundId} onValueChange={setSelectedFundId}>
                      <SelectTrigger><SelectValue placeholder="Select fund…" /></SelectTrigger>
                      <SelectContent>
                        {amFunds.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name ?? f.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      The fund&apos;s full value is treated as invested — no capital call is created.
                    </p>
                  </Field>
                  {selectedFundId && (
                    <Field>
                      <FieldLabel htmlFor="fi-name">Display name <span className="text-destructive">*</span></FieldLabel>
                      <Input
                        id="fi-name"
                        placeholder="Fund name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </Field>
                  )}
                </>
              ) : (
                <>
                  <Field>
                    <FieldLabel htmlFor="fi-email">Email</FieldLabel>
                    <Input
                      id="fi-email"
                      type="email"
                      placeholder="investor@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="fi-name">Full name <span className="text-destructive">*</span></FieldLabel>
                    <Input
                      id="fi-name"
                      placeholder="e.g. John Smith or Acme Capital Ltd"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                </>
              )}
            </section>

            {/* ── INVESTMENT ── */}
            {type !== "fund" && <section className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Investment</p>

              <Field>
                <FieldLabel>Currency</FieldLabel>
                <Select
                  value={currencyId != null ? String(currencyId) : ""}
                  onValueChange={(v) => setCurrencyId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency…" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.code}{c.name ? ` — ${c.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {shareClasses.length > 0 && (
                <Field>
                  <FieldLabel>Share class</FieldLabel>
                  <Select value={shareClassId} onValueChange={setShareClassId}>
                    <SelectTrigger><SelectValue placeholder="Select share class…" /></SelectTrigger>
                    <SelectContent>
                      {shareClasses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name ?? s.id}
                          {s.current_nav != null && ` — ${fmtCcy(s.current_nav, displayCode)}/share`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="fi-committed">Committed amount</FieldLabel>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{displayCode}</span>
                  <Input
                    id="fi-committed"
                    type="number" min="0" step="0.01"
                    className="pl-12"
                    placeholder="0.00"
                    value={committedAmount}
                    onChange={(e) => setCommittedAmount(e.target.value)}
                  />
                </div>
              </Field>
            </section>}

            {/* ── SUBSCRIPTION RECORD ── */}
            {type !== "fund" && <section className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subscription record</p>

              <DatePickerInput
                id="fi-record-date"
                label="Record date"
                value={subscriptionDate}
                onChange={setSubscriptionDate}
              />

              <div className="grid grid-cols-3 gap-2">
                {(["none", "pending", "paid"] as const).map((mode) => {
                  const labels = { none: "Cap table only", pending: "Issue call", paid: "Record as paid" }
                  const descs = { none: "No capital call", pending: "Notifies investor", paid: "Bypasses workflow" }
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRecordMode(mode)}
                      className={`rounded-lg border p-2.5 text-left transition-colors ${
                        recordMode === mode
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <p className="text-xs font-medium">{labels[mode]}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{descs[mode]}</p>
                    </button>
                  )
                })}
              </div>

              {recordMode !== "none" && (
                <div className="flex flex-col gap-3">
                  {recordMode === "paid" && (
                    <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-700">
                      <Info className="size-3.5 shrink-0 mt-0.5" />
                      <span>Bypass mode — no email, notification, or task will be created. Money is recorded as already received.</span>
                    </div>
                  )}

                  <Field>
                    <FieldLabel htmlFor="fi-call-amount">
                      {recordMode === "paid" ? "Net amount (for shares)" : "Call amount"}
                    </FieldLabel>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{displayCode}</span>
                      <Input
                        id="fi-call-amount"
                        type="number" min="0" step="0.01"
                        className="pl-12"
                        placeholder="0.00"
                        value={callAmount}
                        onChange={(e) => setCallAmount(e.target.value)}
                      />
                    </div>
                  </Field>

                  {recordMode === "paid" && (
                    <>
                      <Field>
                        <FieldLabel htmlFor="fi-fee-rate">Entry fee %</FieldLabel>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input
                              id="fi-fee-rate"
                              type="number" min="0" max="100" step="0.01"
                              placeholder="0"
                              value={entryFeeRate}
                              onChange={(e) => setEntryFeeRate(e.target.value)}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                          </div>
                          {netAmount != null && feeRateDecimal > 0 && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              = {fmtCcy(feeAmount, displayCode)} fee
                            </span>
                          )}
                        </div>
                      </Field>

                      {/* Calculation preview */}
                      {netAmount != null && netAmount > 0 && (
                        <div className="rounded-lg bg-muted/40 border p-3 text-xs flex flex-col gap-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Net for shares</span>
                            <span className="font-medium tabular-nums">{fmtCcy(netAmount, displayCode)}</span>
                          </div>
                          {feeAmount > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Entry fee ({entryFeeRate}%)</span>
                              <span className="tabular-nums text-muted-foreground">+ {fmtCcy(feeAmount, displayCode)}</span>
                            </div>
                          )}
                          {feeAmount > 0 && grossWire != null && (
                            <div className="flex justify-between border-t pt-1 mt-0.5">
                              <span className="text-muted-foreground">Gross wire (investor pays)</span>
                              <span className="font-semibold tabular-nums">{fmtCcy(grossWire, displayCode)}</span>
                            </div>
                          )}
                          {sharesIssued != null && sc?.current_nav != null && (
                            <div className="flex justify-between border-t pt-1 mt-0.5">
                              <span className="text-muted-foreground">Shares @ {fmtCcy(sc.current_nav, displayCode)}</span>
                              <span className="font-semibold tabular-nums">
                                {new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 }).format(sharesIssued)}
                              </span>
                            </div>
                          )}
                          {sc && !sc.current_nav && (
                            <p className="text-amber-600 flex items-center gap-1 mt-0.5">
                              <AlertCircle className="size-3" /> No NAV set — shares will be calculated at period open
                            </p>
                          )}
                        </div>
                      )}

                      <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded"
                          checked={markDeployed}
                          onChange={(e) => setMarkDeployed(e.target.checked)}
                        />
                        <div>
                          <p className="text-sm font-medium">Mark as deployed</p>
                          <p className="text-xs text-muted-foreground">
                            Tick this for historical records where capital was already deployed into a previous period.
                            Leave unticked to deploy via the period opening flow.
                          </p>
                        </div>
                      </label>
                    </>
                  )}
                </div>
              )}
            </section>}

            {error && <FieldError>{error}</FieldError>}
          </div>

          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? <Spinner className="size-4 mr-2" /> : null}
              Add investor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
