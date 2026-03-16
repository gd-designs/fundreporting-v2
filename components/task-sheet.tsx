"use client"

import * as React from "react"
import { Trash2, Check, Clock, CircleDot, CircleOff, AlertCircle, ThumbsUp, ThumbsDown, Banknote } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DateTimePickerInput } from "@/components/date-time-input"
import { DatePickerInput } from "@/components/date-input"
import type { Asset, UnifiedEntity } from "@/lib/types"
import { AddEntityDialog } from "@/components/add-entity-dialog"
import { Switch } from "@/components/ui/switch"

export type Task = {
  id: string
  title?: string | null
  description?: string | null
  status?: "todo" | "in_progress" | "done" | "cancelled" | null
  priority?: "low" | "medium" | "high" | "urgent" | null
  due_date?: number | null
  entity?: string | null
  created_at?: number | null
  object_type?: string | null
  object_id?: string | null
  owner?: number | null
  assigned_to?: number[] | null
}

const STATUS_OPTIONS = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
]

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
}

function StatusIcon({ status }: { status?: string | null }) {
  if (status === "done") return <Check className="size-4 text-green-600" />
  if (status === "in_progress") return <Clock className="size-4 text-blue-600" />
  if (status === "cancelled") return <CircleOff className="size-4 text-red-500" />
  return <CircleDot className="size-4 text-slate-400" />
}

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—"
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms))
}

function toDate(ms: number | null | undefined): Date | undefined {
  if (!ms) return undefined
  return new Date(ms)
}

export function TaskSheet({
  task: initialTask,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: {
  task: Task | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onUpdated?: (updated: Task) => void
  onDeleted?: (id: string) => void
}) {
  const [task, setTask] = React.useState<Task | null>(initialTask)
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [status, setStatus] = React.useState<string>("")
  const [priority, setPriority] = React.useState<string>("")
  const [dueDate, setDueDate] = React.useState<Date | undefined>(undefined)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [actioning, setActioning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [dirty, setDirty] = React.useState(false)

  // Capital call payment state
  const [capitalCall, setCapitalCall] = React.useState<Record<string, unknown> | null>(null)
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [paymentDate, setPaymentDate] = React.useState<Date | undefined>(new Date())
  const [paymentEntities, setPaymentEntities] = React.useState<UnifiedEntity[]>([])
  const [paymentEntityId, setPaymentEntityId] = React.useState("")
  const [paymentAssets, setPaymentAssets] = React.useState<Asset[]>([])
  const [paymentAssetId, setPaymentAssetId] = React.useState("")
  const [cashBalance, setCashBalance] = React.useState(0)
  const [cashBalanceLoading, setCashBalanceLoading] = React.useState(false)
  const [recordNewMoneyIn, setRecordNewMoneyIn] = React.useState(true)
  const [paymentSaving, setPaymentSaving] = React.useState(false)
  const [currentUserId, setCurrentUserId] = React.useState<number | null>(null)

  React.useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(u => {
      if (u?.id) setCurrentUserId(u.id)
    }).catch(() => {})
  }, [])

  // When sheet opens or task changes, sync state
  React.useEffect(() => {
    if (open && initialTask) {
      setTask(initialTask)
      setTitle(initialTask.title ?? "")
      setDescription(initialTask.description ?? "")
      setStatus(initialTask.status ?? "todo")
      setPriority(initialTask.priority ?? "")
      setDueDate(toDate(initialTask.due_date))
      setDirty(false)
      setError(null)

      // Fetch full task to get all fields (including object_id/object_type)
      fetch(`/api/tasks/${initialTask.id}`)
        .then(r => r.ok ? r.json() : null)
        .then((data: Task | null) => {
          if (data) {
            setTask(data)
            setDescription(data.description ?? "")
            // Fetch capital call details + LP entities once we have the full task
            if (data.object_type === "capital_call" && data.object_id) {
              setCapitalCall(null)
              setPaymentOpen(false)
              setPaymentEntities([])
              setPaymentEntityId("")
              setPaymentAssets([])
              setPaymentAssetId("")
              Promise.all([
                fetch(`/api/capital-calls/${data.object_id}`).then(r => r.ok ? r.json() : null),
                fetch("/api/entities").then(r => r.ok ? r.json() : []),
              ]).then(([cc, entities]: [Record<string, unknown> | null, UnifiedEntity[]]) => {
                if (!cc) return
                setCapitalCall(cc)
                setPaymentAmount(cc.amount != null ? String(cc.amount) : "")
                setPaymentDate(new Date())
                // Only show portfolio entities
                const ccCurrencyId = (cc as Record<string, unknown> & { _entity?: { _fund?: { currency?: number } | null } | null })._entity?._fund?.currency ?? null
                const lpEntities = (entities as UnifiedEntity[]).filter(e => e.type === "portfolio")
                setPaymentEntities(lpEntities)
                const firstId = lpEntities[0]?.entity ?? ""
                setPaymentEntityId(firstId)
                if (firstId) {
                  fetch(`/api/assets?entity=${firstId}`)
                    .then(r => r.ok ? r.json() : [])
                    .then((all: Asset[]) => {
                      const cash = all.filter(a => a.investable === "investable_cash")
                      // Prefer asset matching call currency
                      const sorted = ccCurrencyId
                        ? [...cash.filter(a => a.currency === ccCurrencyId), ...cash.filter(a => a.currency !== ccCurrencyId)]
                        : cash
                      setPaymentAssets(sorted)
                      setPaymentAssetId(sorted[0]?.id ?? "")
                    })
                    .catch(() => {})
                }
              }).catch(() => {})
            }
          }
        })
        .catch(() => {})
    }
  }, [open, initialTask?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch cash assets when LP entity selection changes
  React.useEffect(() => {
    if (!paymentEntityId || !capitalCall) return
    setPaymentAssets([])
    setPaymentAssetId("")
    const ccCurrencyId = (capitalCall as Record<string, unknown> & { _entity?: { _fund?: { currency?: number } | null } | null })._entity?._fund?.currency ?? null
    fetch(`/api/assets?entity=${paymentEntityId}`)
      .then(r => r.ok ? r.json() : [])
      .then((all: Asset[]) => {
        const cash = all.filter(a => a.investable === "investable_cash")
        const sorted = ccCurrencyId
          ? [...cash.filter(a => a.currency === ccCurrencyId), ...cash.filter(a => a.currency !== ccCurrencyId)]
          : cash
        setPaymentAssets(sorted)
        setPaymentAssetId(sorted[0]?.id ?? "")
      })
      .catch(() => {})
  }, [paymentEntityId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch cash balance when asset changes
  React.useEffect(() => {
    if (!paymentAssetId || !paymentEntityId) { setCashBalance(0); return }
    setCashBalanceLoading(true)
    fetch(`/api/transaction-entries?entity=${paymentEntityId}&object_id=${paymentAssetId}`)
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(data => {
        const entries: { direction: string; amount: number }[] = Array.isArray(data.entries) ? data.entries : []
        const bal = entries.reduce((s, e) => s + (e.direction === "in" ? (e.amount ?? 0) : -(e.amount ?? 0)), 0)
        setCashBalance(bal)
        // If no balance, force new money in
        if (bal <= 0) setRecordNewMoneyIn(true)
      })
      .catch(() => {})
      .finally(() => setCashBalanceLoading(false))
  }, [paymentAssetId, paymentEntityId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStatusQuickSet(newStatus: string) {
    if (!task) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      const updated: Task = await res.json()
      setTask(updated)
      setStatus(updated.status ?? "")
      onUpdated?.(updated)
    } catch {
      setError("Failed to update status.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!task) return
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        title: title.trim() || null,
        description: description.trim() || null,
        status: status || null,
        priority: priority || null,
        due_date: dueDate ? dueDate.getTime() : null,
      }
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed to save task")
      const updated: Task = await res.json()
      setTask(updated)
      setDirty(false)
      onUpdated?.(updated)
    } catch {
      setError("Failed to save task.")
    } finally {
      setSaving(false)
    }
  }

  async function handleCapInviteAction(accept: boolean) {
    if (!task?.object_id) return
    setActioning(true)
    setError(null)
    try {
      const now = Date.now()
      const shPatch = accept
        ? { accepted: true, accepted_at: now }
        : { rejected: true, rejected_at: now }
      await fetch(`/api/cap-table-shareholders/${task.object_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shPatch),
      })
      const newStatus = accept ? "done" : "cancelled"
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update task")
      const updated: Task = await res.json()
      setTask(updated)
      setStatus(updated.status ?? "")
      onUpdated?.(updated)
    } catch {
      setError(`Failed to ${accept ? "accept" : "reject"} invitation.`)
    } finally {
      setActioning(false)
    }
  }

  async function handleCapitalCallPayment() {
    if (!task?.object_id || !capitalCall) return
    if (!paymentEntityId) { setError("Select a portfolio to pay from."); return }
    const parsedAmount = parseFloat(paymentAmount)
    if (!paymentAmount || isNaN(parsedAmount) || parsedAmount <= 0) { setError("Enter a valid amount."); return }
    if (!paymentDate) { setError("Select a date."); return }

    setPaymentSaving(true)
    setError(null)
    try {
      const cc = capitalCall as {
        _share_class?: { current_nav?: number | null } | null
        _entity?: {
          type?: string | null
          _company?: { name?: string | null; country?: number | null } | null
          _fund?: { name?: string | null } | null
          _asset_manager?: { name?: string | null } | null
        } | null
        _cap_table_entry?: { shareholder?: string | null; currency?: number | null } | null
      }
      const entityUUID = paymentEntityId

      // Derive investment asset metadata from capital call data
      const entityType = cc._entity?.type
      const investmentName =
        entityType === "company" ? cc._entity?._company?.name :
        entityType === "fund" ? cc._entity?._fund?.name :
        entityType === "asset_manager" ? cc._entity?._asset_manager?.name :
        null
      const investmentAssetName = investmentName ?? "Fund investment"
      const shareholderId = cc._cap_table_entry?.shareholder ?? null
      const invCurrencyId = cc._cap_table_entry?.currency ?? null
      const invCountry = entityType === "company" ? (cc._entity?._company?.country ?? null) : null
      const currentNav = cc._share_class?.current_nav ?? null
      const sharesIssued = currentNav && currentNav > 0 ? parsedAmount / currentNav : null

      // 1. Resolve cash asset (auto-create if none)
      let cashAssetId = paymentAssetId
      let cashCurrencyId: number | null = null
      const selectedAsset = paymentAssets.find(a => a.id === paymentAssetId)
      if (paymentAssets.length === 0) {
        const r = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: entityUUID, name: "Cash", investable: "investable_cash", asset_class: 1,
            ...(invCurrencyId != null ? { currency: invCurrencyId } : {}),
          }),
        })
        if (!r.ok) throw new Error(await r.text())
        const a = await r.json() as Asset
        cashAssetId = a.id; cashCurrencyId = a.currency ?? null
      } else if (!selectedAsset) {
        setError("Select a cash asset."); setPaymentSaving(false); return
      } else {
        cashCurrencyId = selectedAsset.currency ?? null
      }

      // 2. Find or create investment asset on LP's portfolio
      let investmentAssetId: string
      const existingAssetsRes = await fetch(`/api/assets?entity=${entityUUID}`)
      const existingAssets: Asset[] = existingAssetsRes.ok ? await existingAssetsRes.json() : []
      const existing = existingAssets.find(a =>
        shareholderId ? a.cap_table_shareholder === shareholderId : (a.investable === "non_investable" && a.name === investmentAssetName)
      )
      if (existing) {
        investmentAssetId = existing.id
      } else {
        const newInvRes = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: entityUUID,
            name: investmentAssetName,
            investable: "non_investable",
            asset_class: 3,
            ...(shareholderId ? { cap_table_shareholder: shareholderId } : {}),
            ...(invCurrencyId != null ? { currency: invCurrencyId } : {}),
            ...(invCountry != null ? { country: invCountry } : {}),
            purchasedAt: new Date().toISOString(),
            locked: true,
          }),
        })
        if (!newInvRes.ok) throw new Error(await newInvRes.text())
        investmentAssetId = ((await newInvRes.json()) as Asset).id
      }

      // 3. Transaction header
      const txRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ created_by_entity: entityUUID, date: paymentDate.getTime(), type: 13 }),
      })
      if (!txRes.ok) throw new Error(await txRes.text())
      const tx = await txRes.json() as { id: string }

      const cur = (invCurrencyId ?? cashCurrencyId) != null ? { currency: invCurrencyId ?? cashCurrencyId } : {}

      // Leg 1: new money in to cash asset (if toggled on or no balance)
      if (recordNewMoneyIn || cashBalance <= 0) {
        const r = await fetch("/api/transaction-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction: tx.id, entry_type: "cash", entity: entityUUID,
            object_type: "asset", object_id: cashAssetId,
            direction: "in", amount: parsedAmount, source: "new_money_in", ...cur,
          }),
        })
        if (!r.ok) throw new Error(await r.text())
      }

      // Leg 2: cash out from cash asset
      const r2 = await fetch("/api/transaction-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: tx.id, entry_type: "cash", entity: entityUUID,
          object_type: "asset", object_id: cashAssetId,
          direction: "out", amount: parsedAmount,
          source: "asset", source_id: investmentAssetId, ...cur,
        }),
      })
      if (!r2.ok) throw new Error(await r2.text())

      // Leg 3: asset in to investment asset
      const r3 = await fetch("/api/transaction-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: tx.id, entry_type: "asset", entity: entityUUID,
          object_type: "asset", object_id: investmentAssetId,
          direction: "in", amount: parsedAmount,
          ...(sharesIssued != null ? { units: sharesIssued } : {}),
          ...(currentNav != null ? { price_per_unit: currentNav } : {}),
          source: "cash", source_id: cashAssetId, ...cur,
        }),
      })
      if (!r3.ok) throw new Error(await r3.text())

      // Stamp received_at + status on the capital call
      await fetch(`/api/capital-calls/${task.object_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ received_at: paymentDate.getTime(), status: "paid" }),
      })

      // Notify company UBOs that capital has been settled (fire-and-forget)
      const ccEntity = (capitalCall as Record<string, unknown>).entity as string | null
      if (ccEntity) {
        fetch(`/api/cap-table-shareholders?entity=${ccEntity}`)
          .then(r => r.ok ? r.json() : [])
          .then(async (ubos: Array<{ user: number | null }>) => {
            const userIds = ubos.map(u => u.user).filter((u): u is number => u != null)
            if (userIds.length === 0) return
            const entityType = cc._entity?.type
            const companyName =
              entityType === "company" ? (cc._entity?._company?.name ?? "the company") :
              entityType === "fund" ? (cc._entity?._fund?.name ?? "the fund") :
              entityType === "asset_manager" ? (cc._entity?._asset_manager?.name ?? "the manager") :
              "the company"
            const title = `Capital call settled — ${companyName}`
            const taskBody = JSON.stringify({
              assigned_to: userIds,
              object_type: "capital_call",
              object_id: task.object_id,
              entity: ccEntity,
              title,
              description: `A capital call has been settled in ${companyName}. Please inject the capital into the company's cash asset.`,
              status: "todo",
              priority: "medium",
            })
            const settlementTaskRes = await fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: taskBody,
            }).catch(() => null)
            const settlementTask = settlementTaskRes?.ok ? await settlementTaskRes.json() : null
            await fetch("/api/notifications", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                assigned_to: userIds,
                type: "capital_call",
                resource_id: task.object_id,
                task: settlementTask?.id ?? null,
                title,
                body: `Capital has been received. Please inject into ${companyName}.`,
                read: false,
              }),
            }).catch(() => {})
          })
          .catch(() => {})
      }

      // Mark task done
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      })
      if (!res.ok) throw new Error("Failed to update task")
      const updated: Task = await res.json()
      setTask(updated); setStatus(updated.status ?? ""); setPaymentOpen(false)
      onUpdated?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment.")
    } finally {
      setPaymentSaving(false)
    }
  }

  async function handleDelete() {
    if (!task || !window.confirm("Delete this task?")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      onDeleted?.(task.id)
      onOpenChange(false)
    } catch {
      setError("Failed to delete task.")
    } finally {
      setDeleting(false)
    }
  }

  const isOverdue = task?.due_date && new Date(task.due_date) < new Date() && task.status !== "done" && task.status !== "cancelled"

  if (!task) return null

  const canAct = currentUserId == null || task.owner === currentUserId || (task.assigned_to ?? []).includes(currentUserId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[90vw]! overflow-y-auto flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2.5 min-w-0">
            <StatusIcon status={status || task.status} />
            <SheetTitle className="text-base leading-snug">
              {task.title ?? "Untitled task"}
            </SheetTitle>
          </div>
          <SheetDescription>
            Created {formatDate(task.created_at)}
            {isOverdue && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600">
                <AlertCircle className="size-3" />
                Overdue
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Status quick-actions */}
        <div className="flex gap-2 px-6 py-3 border-b flex-wrap">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { if (canAct) { setStatus(opt.value); setDirty(true) } }}
              disabled={!canAct}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                (status || task.status) === opt.value
                  ? STATUS_COLORS[opt.value]
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-px bg-border border-b">
          <div className="bg-background px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Status</p>
            <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[(status || task.status) ?? "todo"]}`}>
              {STATUS_OPTIONS.find(o => o.value === (status || task.status))?.label ?? "—"}
            </p>
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Priority</p>
            {(priority || task.priority) ? (
              <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[(priority || task.priority) ?? "low"]}`}>
                {PRIORITY_OPTIONS.find(o => o.value === (priority || task.priority))?.label ?? "—"}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">—</p>
            )}
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Due date</p>
            <p className={`mt-1 text-sm font-medium ${isOverdue ? "text-red-600" : ""}`}>
              {formatDate(task.due_date)}
            </p>
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Created</p>
            <p className="mt-1 text-sm font-medium">{formatDate(task.created_at)}</p>
          </div>
        </div>

        {/* Cap invite action */}
        {task.object_type === "cap_invite" && (
          <div className="px-6 py-4 border-b space-y-3">
            <p className="text-sm font-medium">Respond to invitation</p>
            {status === "done" ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-700 px-3 py-1.5 text-sm font-medium">
                <ThumbsUp className="size-3.5" />
                Accepted
              </div>
            ) : status === "cancelled" ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 text-red-700 px-3 py-1.5 text-sm font-medium">
                <ThumbsDown className="size-3.5" />
                Rejected
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={() => handleCapInviteAction(true)}
                  disabled={actioning}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <ThumbsUp className="size-3.5" />
                  Accept
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleCapInviteAction(false)}
                  disabled={actioning}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                >
                  <ThumbsDown className="size-3.5" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Capital call payment */}
        {task.object_type === "capital_call" && (
          <div className="px-6 py-4 border-b space-y-3">
            <p className="text-sm font-medium">Capital call payment</p>
            {capitalCall && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {capitalCall.amount != null && (
                  <span>Amount: <span className="font-semibold text-foreground">
                    {new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(capitalCall.amount as number)}
                  </span></span>
                )}
              </div>
            )}
            {(status === "done" || task.status === "done") ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-700 px-3 py-1.5 text-sm font-medium">
                <Check className="size-3.5" />
                Payment recorded
              </div>
            ) : !paymentOpen ? (
              <Button size="sm" onClick={() => setPaymentOpen(true)} disabled={!capitalCall || !canAct} title={!canAct ? "Only the assigned recipient can record this payment" : undefined}>
                <Banknote className="size-3.5" />
                Record payment
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-1.5">
                  <Label>Pay from portfolio</Label>
                  {paymentEntities.length > 0 ? (
                    <Select value={paymentEntityId} onValueChange={setPaymentEntityId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select portfolio…" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentEntities.map(e => (
                          <SelectItem key={e.entity} value={e.entity}>{e.name ?? e.entity}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">You don't have a portfolio yet.</p>
                      <AddEntityDialog
                        defaultType="portfolio"
                        onCreated={(entity) => {
                          const e = entity as unknown as UnifiedEntity
                          setPaymentEntities([e])
                          setPaymentEntityId(e.entity)
                        }}
                      >
                        <Button size="sm" variant="outline" type="button">Create portfolio</Button>
                      </AddEntityDialog>
                    </div>
                  )}
                </div>
                {paymentAssets.length > 0 ? (
                  <div className="space-y-1.5">
                    <Label>Cash asset to debit</Label>
                    <Select value={paymentAssetId} onValueChange={setPaymentAssetId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select cash asset…" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentAssets.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name ?? a.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!cashBalanceLoading && (
                      <p className="text-xs text-muted-foreground">
                        Balance: <span className={cashBalance <= 0 ? "text-destructive font-medium" : "font-medium"}>
                          {new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2 }).format(cashBalance)}
                        </span>
                      </p>
                    )}
                  </div>
                ) : paymentEntityId ? (
                  <p className="text-xs text-muted-foreground">No cash asset found — one will be created automatically.</p>
                ) : null}
                {paymentAssetId && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="grid gap-0.5">
                      <p className="text-sm font-medium">
                        {recordNewMoneyIn ? "Record new money in" : "Use existing cash balance"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {recordNewMoneyIn
                          ? "Adds a money-in entry to the cash account before the payment."
                          : "Uses the existing cash balance — no new money-in entry recorded."}
                      </p>
                    </div>
                    <Switch
                      checked={recordNewMoneyIn}
                      onCheckedChange={setRecordNewMoneyIn}
                      disabled={cashBalance <= 0}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="pay-amount">Amount</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <DatePickerInput label="Date" value={paymentDate} onChange={setPaymentDate} />
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleCapitalCallPayment} disabled={paymentSaving}>
                    {paymentSaving ? "Recording…" : "Confirm payment"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPaymentOpen(false)} disabled={paymentSaving}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit form */}
        <div className="px-6 py-5 space-y-4 flex-1">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={e => { setTitle(e.target.value); setDirty(true) }}
              placeholder="Task title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={v => { setStatus(v); setDirty(true) }} disabled={!canAct}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={v => { setPriority(v); setDirty(true) }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DateTimePickerInput
            id="task-due"
            label="Due date"
            value={dueDate}
            onChange={d => { setDueDate(d); setDirty(true) }}
            showTime={false}
          />

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={e => { setDescription(e.target.value); setDirty(true) }}
              placeholder="Add a description…"
              rows={4}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || !dirty || !canAct}
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {(status || task.status) !== "done" && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusQuickSet("done")}
                  disabled={saving || !canAct}
                >
                  <Check className="size-3.5" />
                  Mark done
                </Button>
              )}
            </div>
            {canAct && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
