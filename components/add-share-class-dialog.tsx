"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FeeForm,
  FEE_TYPE_LABELS,
  BASIS_LABELS,
  FREQ_LABELS,
  emptyFee,
  type FeeRow,
} from "@/components/share-class-fee-form"

type DistRow = {
  _key: string
  name: string
  basis: "nav" | "committed_capital" | "fixed"
  rate: string
  fixedAmount: string
  frequency: "monthly" | "quarterly" | "bi-annually" | "annually" | "on_close"
}

function emptyDist(): DistRow {
  return { _key: crypto.randomUUID(), name: "", basis: "nav", rate: "", fixedAmount: "", frequency: "on_close" }
}

const DIST_BASIS_LABELS: Record<string, string> = {
  nav: "% of NAV",
  committed_capital: "% of committed",
  fixed: "Fixed/share",
}

const DIST_FREQ_LABELS: Record<string, string> = {
  monthly: "Monthly", quarterly: "Quarterly", "bi-annually": "Bi-annually",
  annually: "Annually", on_close: "On close",
}

export function AddShareClassDialog({
  open,
  onClose,
  entityUUID,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  entityUUID: string
  onSaved: () => void
}) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1)
  const [createdId, setCreatedId] = React.useState<string | null>(null)

  // Step 1 fields
  const [name, setName] = React.useState("")
  const [currentNav, setCurrentNav] = React.useState("")
  const [votingRights, setVotingRights] = React.useState(false)
  const [liquidationPref, setLiquidationPref] = React.useState("")
  const [liquidationRank, setLiquidationRank] = React.useState("")
  const [notes, setNotes] = React.useState("")

  // Step 2 fields
  const [addedFees, setAddedFees] = React.useState<FeeRow[]>([])
  const [draftFee, setDraftFee] = React.useState<FeeRow>(emptyFee())

  // Step 3 fields
  const [addedDists, setAddedDists] = React.useState<DistRow[]>([])
  const [draftDist, setDraftDist] = React.useState<DistRow>(emptyDist())

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setStep(1); setCreatedId(null)
      setName(""); setCurrentNav(""); setVotingRights(false)
      setLiquidationPref(""); setLiquidationRank(""); setNotes("")
      setAddedFees([]); setDraftFee(emptyFee())
      setAddedDists([]); setDraftDist(emptyDist())
      setError(null)
    }
  }, [open])

  const STEP_LABELS = ["Share class details", "Fee structure", "Distribution schemes"]

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Name is required."); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/share-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: entityUUID,
          name: name.trim(),
          current_nav: currentNav ? Number(currentNav) : null,
          voting_rights: votingRights,
          liquidation_preference: liquidationPref ? Number(liquidationPref) : null,
          liquidation_rank: liquidationRank ? Number(liquidationRank) : null,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to create share class")
      const created = await res.json() as { id: string }
      setCreatedId(created.id)
      setStep(2)
    } catch {
      setError("Failed to create share class.")
    } finally {
      setSaving(false)
    }
  }

  function handleAddFee(fee: FeeRow) {
    setAddedFees((prev) => [...prev, fee])
    setDraftFee(emptyFee())
  }

  async function handleFinish() {
    if (!createdId) return
    setSaving(true); setError(null)
    try {
      const tasks: Promise<unknown>[] = []

      for (const fee of addedFees) {
        tasks.push(
          fetch("/api/share-class-fees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entity: entityUUID,
              share_class: createdId,
              type: fee.type || null,
              rate: fee.rate ? Number(fee.rate) : null,
              rate_is_annual: fee.rateIsAnnual,
              basis: fee.basis || null,
              frequency: fee.frequency || null,
              fixed_amount: fee.fixedAmount ? Number(fee.fixedAmount) : null,
              hurdle_rate: fee.hurdleRate ? Number(fee.hurdleRate) : null,
              high_water_mark: fee.highWaterMark,
              catch_up_rate: fee.catchUpRate ? Number(fee.catchUpRate) : null,
            }),
          })
        )
      }

      for (const d of addedDists) {
        tasks.push(
          fetch("/api/share-class-distributions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entity: entityUUID,
              share_class: createdId,
              name: d.name || null,
              basis: d.basis,
              rate: d.basis !== "fixed" && d.rate ? Number(d.rate) : null,
              fixed_amount: d.basis === "fixed" && d.fixedAmount ? Number(d.fixedAmount) : null,
              frequency: d.frequency,
              enabled: true,
            }),
          })
        )
      }

      await Promise.all(tasks)
      onSaved()
      onClose()
    } catch {
      setError("Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Add share class" : step === 2 ? "Add fees" : "Add distributions"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Step {step} of 3 — {STEP_LABELS[step - 1]}
          </p>
        </DialogHeader>

        {/* ── Step 1: Details ── */}
        {step === 1 && (
          <form onSubmit={handleStep1}>
            <FieldGroup className="mt-2">
              <Field>
                <FieldLabel htmlFor="sc-name">Name</FieldLabel>
                <Input id="sc-name" placeholder="e.g. Class A" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="sc-nav">Initial NAV / share</FieldLabel>
                <Input id="sc-nav" type="number" min="0" step="0.0001" placeholder="e.g. 1000" value={currentNav} onChange={(e) => setCurrentNav(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="sc-liq-pref">Liquidation preference</FieldLabel>
                  <Input id="sc-liq-pref" type="number" min="0" step="0.01" placeholder="Optional" value={liquidationPref} onChange={(e) => setLiquidationPref(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="sc-liq-rank">Liquidation rank</FieldLabel>
                  <Input id="sc-liq-rank" type="number" min="1" step="1" placeholder="Optional" value={liquidationRank} onChange={(e) => setLiquidationRank(e.target.value)} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="sc-notes">Notes</FieldLabel>
                <Textarea id="sc-notes" placeholder="Optional" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox checked={votingRights} onCheckedChange={(v) => setVotingRights(v === true)} />
                Voting rights
              </label>
              {error && <FieldError>{error}</FieldError>}
            </FieldGroup>
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner className="size-4" /> : "Next →"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* ── Step 2: Fees ── */}
        {step === 2 && (
          <div className="mt-2 space-y-4">
            {addedFees.length > 0 && (
              <div className="space-y-2">
                {addedFees.map((fee) => (
                  <div key={fee._key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="font-medium">{FEE_TYPE_LABELS[fee.type] ?? fee.type}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {fee.basis === "fixed"
                        ? <span>{fee.fixedAmount || "—"} fixed</span>
                        : <span>{fee.rate || "—"}%{fee.rateIsAnnual ? " p.a." : ""}</span>
                      }
                      <span>{BASIS_LABELS[fee.basis] ?? fee.basis}</span>
                      <span>{FREQ_LABELS[fee.frequency] ?? fee.frequency}</span>
                      <button onClick={() => setAddedFees((prev) => prev.filter((f) => f._key !== fee._key))} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <FeeForm value={draftFee} onChange={setDraftFee} onAdd={handleAddFee} />

            {error && <FieldError>{error}</FieldError>}

            <DialogFooter className="flex-row justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                Skip
              </Button>
              <Button onClick={() => setStep(3)} disabled={saving}>
                Next →
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 3: Distribution schemes ── */}
        {step === 3 && (
          <div className="mt-2 space-y-4">
            {addedDists.length > 0 && (
              <div className="space-y-2">
                {addedDists.map((d) => (
                  <div key={d._key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="font-medium">{d.name || (d.basis === "fixed" ? `${d.fixedAmount || "—"} fixed` : `${d.rate || "—"}%`)}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{DIST_BASIS_LABELS[d.basis]}</span>
                      <span>{DIST_FREQ_LABELS[d.frequency]}</span>
                      <button onClick={() => setAddedDists((prev) => prev.filter((x) => x._key !== d._key))} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add scheme</p>
              <Field>
                <FieldLabel>Name (optional)</FieldLabel>
                <Input placeholder="e.g. Quarterly income" value={draftDist.name} onChange={(e) => setDraftDist((d) => ({ ...d, name: e.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>Basis</FieldLabel>
                  <Select value={draftDist.basis} onValueChange={(v) => setDraftDist((d) => ({ ...d, basis: v as DistRow["basis"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nav">% of current value (NAV)</SelectItem>
                      <SelectItem value="committed_capital">% of total investment</SelectItem>
                      <SelectItem value="fixed">Fixed amount per share</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Frequency</FieldLabel>
                  <Select value={draftDist.frequency} onValueChange={(v) => setDraftDist((d) => ({ ...d, frequency: v as DistRow["frequency"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="bi-annually">Bi-annually</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                      <SelectItem value="on_close">On period close</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {draftDist.basis === "fixed" ? (
                <Field>
                  <FieldLabel>Fixed amount per share</FieldLabel>
                  <Input type="number" min="0" step="0.0001" placeholder="e.g. 10.00" value={draftDist.fixedAmount} onChange={(e) => setDraftDist((d) => ({ ...d, fixedAmount: e.target.value }))} />
                </Field>
              ) : (
                <Field>
                  <FieldLabel>Rate (%)</FieldLabel>
                  <Input type="number" min="0" step="0.01" placeholder="e.g. 3.00" value={draftDist.rate} onChange={(e) => setDraftDist((d) => ({ ...d, rate: e.target.value }))} />
                </Field>
              )}
              <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => { setAddedDists((prev) => [...prev, draftDist]); setDraftDist(emptyDist()) }}>
                + Add scheme
              </Button>
            </div>

            {error && <FieldError>{error}</FieldError>}

            <DialogFooter className="flex-row justify-between">
              <Button type="button" variant="ghost" onClick={() => { onSaved(); onClose() }}>
                Skip
              </Button>
              <Button onClick={handleFinish} disabled={saving}>
                {saving ? <Spinner className="size-4" /> : "Done"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
