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
  FeeForm,
  FEE_TYPE_LABELS,
  BASIS_LABELS,
  FREQ_LABELS,
  emptyFee,
  type FeeRow,
} from "@/components/share-class-fee-form"

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
  const [step, setStep] = React.useState<1 | 2>(1)
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

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setStep(1); setCreatedId(null)
      setName(""); setCurrentNav(""); setVotingRights(false)
      setLiquidationPref(""); setLiquidationRank(""); setNotes("")
      setAddedFees([]); setDraftFee(emptyFee())
      setError(null)
    }
  }, [open])

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

  function removeFee(key: string) {
    setAddedFees((prev) => prev.filter((f) => f._key !== key))
  }

  async function handleFinish() {
    if (!createdId) return
    if (addedFees.length === 0) { onSaved(); onClose(); return }
    setSaving(true); setError(null)
    try {
      await Promise.all(
        addedFees.map((fee) =>
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
      )
      onSaved()
      onClose()
    } catch {
      setError("Failed to save fees.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === 1 ? "Add share class" : "Add fees"}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Step {step} of 2 — {step === 1 ? "Share class details" : "Fee structure"}
          </p>
        </DialogHeader>

        {/* ── Step 1 ── */}
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

        {/* ── Step 2 ── */}
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
                      <button onClick={() => removeFee(fee._key)} className="text-destructive hover:text-destructive/80">
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
              <Button type="button" variant="ghost" onClick={() => { onSaved(); onClose() }}>
                Skip fees
              </Button>
              <Button onClick={handleFinish} disabled={saving}>
                {saving ? <Spinner className="size-4" /> : addedFees.length > 0 ? `Save ${addedFees.length} fee${addedFees.length > 1 ? "s" : ""}` : "Done"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
